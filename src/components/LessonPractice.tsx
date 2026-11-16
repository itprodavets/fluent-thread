import { useId, useState } from 'react';
import { useWorkspace } from '../context';
import { lessonPractice, teacherPhraseCards } from '../domain/lesson-practice';
import { normalize } from '../domain/model';
import type { Resource } from '../domain/model';
import { stopSpeaking } from '../domain/voice.js';
import { Fold, VoiceButtons } from './common';
import { WordExamples } from './WordExamples';

type Phrase = ReturnType<typeof teacherPhraseCards>[number];

function PhraseRecall({ cards, language }: { cards: Phrase[]; language: string }) {
  const { active } = useWorkspace();
  const [index, setIndex] = useState(0);
  const [revealed, reveal] = useState(false);
  const card = cards[index];
  const term = normalize(card.phrase.replace(/[.?!]+$/, ''), language);
  const word = active.words.find(entry => entry.language === language &&
    normalize(entry.title, language) === term && normalize(entry.meaning, language) === normalize(card.meaning, language));
  function move(next: number) {
    stopSpeaking();
    setIndex(next);
    reveal(false);
  }
  return <section className="lesson-recall" aria-label="Вспомнить фразу">
    <h4>Вспомнить фразу</h4>
    <p className="sub">Скажи фразу по-английски, затем сверься и придумай, где ты сам мог бы её сказать.</p>
    <p role="status">Фраза {index + 1} из {cards.length}</p>
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

export function LessonPractice({ resources, topicId }: { resources: Resource[]; topicId: string }) {
  const id = useId();
  const { teacher, grammar, exercises } = lessonPractice(resources, topicId);
  if (!teacher.length && !grammar.length && !exercises.length) return null;
  return <section className="resource lesson-practice" aria-labelledby={id}>
    <h3 id={id}>Реплики преподавателя и грамматика</h3>
    {!!teacher.length && <Fold title="Фразы преподавателя">
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
