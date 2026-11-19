import { useEffect, useId, useState } from 'react';
import { useWorkspace } from '../context';
import { assessPhraseCard, assessTeacherPhrase, lessonPractice, phraseVocabularyId, phraseWordKey, teacherPhraseCards } from '../domain/lesson-practice';
import { lessonReviewDue } from '../domain/lesson-review';
import type { PhraseCard } from '../domain/lesson-practice';
import { dateLabel, lastSpoken } from '../domain/model';
import type { Resource } from '../domain/model';
import { stopSpeaking } from '../domain/voice.js';
import { Fold, VoiceButtons } from './common';
import { WordExamples } from './WordExamples';

type RecallCard = PhraseCard & { wordId?: string };

export function PhraseRecall({ cards, language, vocabulary = false }: {
  cards: RecallCard[]; language: string; vocabulary?: boolean;
}) {
  const { active, study, update } = useWorkspace();
  const [revealed, reveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const words = new Map(active.words.map(entry => [vocabulary ? entry.id : phraseWordKey(entry), entry]));
  const entries = cards.map(card => {
    const word = words.get(card.wordId ?? phraseVocabularyId(card, language));
    const result = word && study.results[word.id];
    const due = vocabulary ? lessonReviewDue(result) : result?.schedules?.spoken?.due ?? result?.due;
    return { card, word, outcome: lastSpoken(result).outcome, due };
  });
  const ready = entries.map((entry, i) => ({ ...entry, i })).filter(entry =>
    vocabulary ? entry.due === undefined || entry.due <= now
      : entry.outcome === 'retry' && entry.due !== undefined && entry.due <= now);
  const [index, setIndex] = useState(() => vocabulary ? ready.find(entry => entry.due !== undefined)?.i ?? ready[0]?.i ?? 0 : 0);
  const { card, word, outcome, due } = entries[index];
  const usable = entries.filter(entry => entry.outcome === 'independent').length;
  const status = vocabulary && due !== undefined && due <= now ? 'Пора повторить'
    : outcome === 'independent' ? 'Могу использовать' : outcome === 'retry' && due !== undefined
    ? due <= now ? 'Пора повторить' : 'Повторить в ' + new Intl.DateTimeFormat('ru', {hour: '2-digit', minute: '2-digit'}).format(due)
    : 'Без отметки';
  async function score(value: 'independent' | 'retry') {
    if ((!word && !card.topicId) || saving) return;
    setSaving(true);
    const timestamp = Date.now();
    try {
      if (await update(current => vocabulary && word
        ? assessTeacherPhrase(current, word, value, timestamp)
        : assessPhraseCard(current, card, language, value, timestamp))) {
        setNow(timestamp);
        if (vocabulary) {
          const next = ready.find(entry => entry.i > index) ?? ready.find(entry => entry.i !== index);
          if (next) move(next.i);
        }
      }
    } finally { setSaving(false); }
  }
  function move(next: number) {
    stopSpeaking();
    setIndex(next);
    reveal(false);
  }
  return <section className="lesson-recall" aria-label={vocabulary ? 'Карточки слов' : 'Вспомнить фразу'}>
    {!vocabulary && <h4>Вспомнить фразу</h4>}
    <p className="sub">{vocabulary ? 'Вспомни английский вариант по переводу. Открой ответ и отметь, вспомнил ли ты его.'
      : 'Скажи фразу по-английски, затем сверься и придумай, где ты сам мог бы её сказать.'}</p>
    <p className="sub" role="status">{vocabulary ? 'Карточка' : 'Фраза'} {index + 1} из {cards.length} · {vocabulary ? 'Вспомнил' : 'Могу использовать'}: {usable} · К повторению: {ready.length}</p>
    {!!ready.length && <button type="button" onClick={() => move((ready.find(entry => entry.i > index) ?? ready[0]).i)}>Перейти к повторению</button>}
    <p className="lesson-recall-cue">{card.meaning}</p>
    <button type="button" aria-expanded={revealed} onClick={() => {
      if (revealed) stopSpeaking();
      reveal(!revealed);
    }}>{revealed ? (vocabulary ? 'Скрыть ответ' : 'Скрыть фразу') : (vocabulary ? 'Показать ответ' : 'Показать фразу')}</button>
    {revealed && <div className="lesson-recall-answer">
      <p><strong lang={language}>{card.phrase}</strong> {card.time && <small>{card.time}</small>}</p>
      {card.source && <p className="sub">{card.source}</p>}
      <VoiceButtons text={card.phrase} language={language} />
      {card.pattern && <p>{card.pattern}</p>}
      {card.example && <p lang={language}>{card.example}</p>}
      {word ? <WordExamples key={word.id} word={word} /> : <label>Твой пример
        <textarea rows={2} lang={language} key={index} />
      </label>}
    </div>}
    {(word || card.topicId) && <div className="phrase-review">
      <p role="status"><strong>{vocabulary && outcome === 'independent' && due !== undefined && due > now
        ? 'Следующее повторение · ' + dateLabel(due) : status}</strong></p>
      {(!vocabulary || revealed) && <div className="actions">
        <button type="button" className="primary" disabled={saving} onClick={() => void score('independent')}>{vocabulary ? 'Вспомнил' : 'Могу использовать'}</button>
        <button type="button" disabled={saving} onClick={() => void score('retry')}>{vocabulary ? 'Ещё раз через 10 минут' : 'Повторить через 10 минут'}</button>
      </div>}
    </div>}
    <div className="actions">
      <button type="button" disabled={index === 0} onClick={() => move(index - 1)}>{vocabulary ? 'Назад' : 'Предыдущая фраза'}</button>
      <button type="button" onClick={() => move((index + 1) % cards.length)}>
        {index + 1 === cards.length ? 'Повторить с первой' : vocabulary ? 'Следующая карточка' : 'Следующая фраза'}
      </button>
    </div>
  </section>;
}

export function LessonVocabulary({ topicId }: { topicId: string }) {
  const { study, active } = useWorkspace();
  const [open, setOpen] = useState(false);
  const links = new Set(active.topics.find(topic => topic.id === topicId)?.links);
  const cards = active.words.filter(word => links.has(word.id) && word.meaning.trim()).map(word => ({
    wordId: word.id, phrase: word.title, meaning: word.meaning, example: word.example,
    pattern: '', topicId
  }));
  if (!cards.length) return null;
  return <details className="resource fold" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Повторить слова · {cards.length}</summary>
    {open && <PhraseRecall key={cards.map(card => card.wordId).join(':')} cards={cards} language={study.language} vocabulary />}
  </details>;
}

function GrammarExercise({ exercise }: { exercise: Resource }) {
  return <Fold className="lesson-grammar-exercise" title={exercise.title.replace(/^Грамматика ·\s*/, '')}>
    <p className="source-text" lang={exercise.language}>{exercise.prompt}</p>
    <label>Твой ответ<textarea rows={3} lang={exercise.language} /></label>
    <Fold title="Ответ для самопроверки"><p className="source-text" lang={exercise.language}>{exercise.answer}</p></Fold>
  </Fold>;
}

export function LessonPractice({ resources, topicId, openPhrases }: { resources: Resource[]; topicId: string; openPhrases?: boolean }) {
  const id = useId();
  const { teacher, grammar, exercises } = lessonPractice(resources, topicId);
  if (!teacher.length && !grammar.length && !exercises.length) return null;
  return <section className="resource lesson-practice" aria-labelledby={id}>
    <h3 id={id}>Полезные фразы и грамматика</h3>
    {!!teacher.length && <Fold title={teacher.some(item => item.title.startsWith('Полезные фразы ·')) ? 'Фразы для практики' : 'Фразы преподавателя'} open={openPhrases}>
      {teacher.map(material => {
        const cards = teacherPhraseCards(material.text).map(card => ({ ...card, topicId }));
        return <div key={material.id}>
          {!!cards.length && <PhraseRecall cards={cards} language={material.language} />}
          <Fold title="Читать все фразы с переводом"><p className="source-text">{material.text}</p></Fold>
        </div>;
      })}
    </Fold>}
    {!!grammar.length && <Fold title="Правила и примеры">
      {grammar.map(material => <p key={material.id} className="source-text">{material.text}</p>)}
    </Fold>}
    {!!exercises.length && <Fold title={`Упражнения по грамматике · ${exercises.length}`}>
      {exercises.map(exercise => <GrammarExercise key={exercise.id} exercise={exercise} />)}
    </Fold>}
  </section>;
}
