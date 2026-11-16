import { useEffect, useId, useState } from 'react';
import { useWorkspace } from '../context';
import { assessTeacherPhrase, lessonPractice, phraseVocabularyId, teacherPhraseCards } from '../domain/lesson-practice';
import { lastSpoken, wordId } from '../domain/model';
import type { Resource } from '../domain/model';
import { stopSpeaking } from '../domain/voice.js';
import { Fold, VoiceButtons } from './common';
import { WordExamples } from './WordExamples';

type Phrase = ReturnType<typeof teacherPhraseCards>[number];

function PhraseRecall({ cards, language }: { cards: Phrase[]; language: string }) {
  const { active, study, update } = useWorkspace();
  const [index, setIndex] = useState(0);
  const [revealed, reveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const words = new Map(active.words.map(entry => [wordId(entry.language, entry.title, entry.meaning), entry]));
  const entries = cards.map(card => {
    const word = words.get(phraseVocabularyId(card, language));
    const result = word && study.results[word.id];
    const due = result?.schedules?.spoken?.due ?? result?.due;
    return { card, word, outcome: lastSpoken(result).outcome, due };
  });
  const { card, word, outcome, due } = entries[index];
  const ready = entries.map((entry, i) => ({ ...entry, i })).filter(entry =>
    entry.outcome === 'retry' && entry.due !== undefined && entry.due <= now);
  const usable = entries.filter(entry => entry.outcome === 'independent').length;
  const status = outcome === 'independent' ? 'Могу использовать' : outcome === 'retry' && due !== undefined
    ? due <= now ? 'Пора повторить' : 'Повторить в ' + new Intl.DateTimeFormat('ru', {hour: '2-digit', minute: '2-digit'}).format(due)
    : 'Без отметки';
  async function score(value: 'independent' | 'retry') {
    if (!word || saving) return;
    setSaving(true);
    const timestamp = Date.now();
    try {
      if (await update(current => assessTeacherPhrase(current, word, value, timestamp))) setNow(timestamp);
    } finally { setSaving(false); }
  }
  function move(next: number) {
    stopSpeaking();
    setIndex(next);
    reveal(false);
  }
  return <section className="lesson-recall" aria-label="Вспомнить фразу">
    <h4>Вспомнить фразу</h4>
    <p className="sub">Скажи фразу по-английски, затем сверься и придумай, где ты сам мог бы её сказать.</p>
    <p className="sub" role="status">Фраза {index + 1} из {cards.length} · Могу использовать: {usable} · К повторению: {ready.length}</p>
    {!!ready.length && <button type="button" onClick={() => move((ready.find(entry => entry.i > index) ?? ready[0]).i)}>Перейти к повторению</button>}
    <p className="lesson-recall-cue">{card.meaning}</p>
    <button type="button" aria-expanded={revealed} onClick={() => {
      if (revealed) stopSpeaking();
      reveal(!revealed);
    }}>{revealed ? 'Скрыть фразу' : 'Показать фразу'}</button>
    {revealed && <div className="lesson-recall-answer">
      <p><strong lang={language}>{card.phrase}</strong> <small>{card.time}</small></p>
      <VoiceButtons text={card.phrase} language={language} />
      {card.pattern && <p>{card.pattern}</p>}
      {card.example && <p lang={language}>{card.example}</p>}
      {word ? <WordExamples key={word.id} word={word} /> : <label>Твой пример
        <textarea rows={2} lang={language} key={index} />
      </label>}
    </div>}
    {word && <div className="phrase-review">
      <p role="status"><strong>{status}</strong></p>
      <div className="actions">
        <button type="button" className="primary" disabled={saving} onClick={() => void score('independent')}>Могу использовать</button>
        <button type="button" disabled={saving} onClick={() => void score('retry')}>Повторить через 10 минут</button>
      </div>
    </div>}
    <div className="actions">
      <button type="button" disabled={index === 0} onClick={() => move(index - 1)}>Предыдущая фраза</button>
      <button type="button" onClick={() => move((index + 1) % cards.length)}>
        {index + 1 === cards.length ? 'Повторить с первой' : 'Следующая фраза'}
      </button>
    </div>
  </section>;
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
    <h3 id={id}>Реплики преподавателя и грамматика</h3>
    {!!teacher.length && <Fold title="Фразы преподавателя" open={openPhrases}>
      {teacher.map(material => {
        const cards = teacherPhraseCards(material.text);
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
