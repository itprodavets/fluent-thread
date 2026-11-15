import { teacherListening } from '../domain/teacher-listening';
import { LessonAudio } from './LessonAudio';
import { useEffect, useState } from 'react';
import { useWorkspace } from '../context';
import { upsert } from '../domain/model';
import { levels, starterLessons, starterScenes } from '../domain/starter-materials';
import type { Level } from '../domain/starter-materials';
import { stopSpeaking } from '../domain/voice.js';
import { Fold, VoiceButtons } from './common';

export function StarterMaterials() {
  const { study, update, practice } = useWorkspace();
  const [level, chooseLevel] = useState<Level>('A1');
  const [clipIndex, chooseClip] = useState(0);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [scene, chooseScene] = useState(starterScenes[0].id);
  if (study.language !== 'en') return null;
  const { resource, source, questions, notes } = starterLessons.find(item => item.sceneId === scene && item.level === level)!;
  const clip = teacherListening[clipIndex];
  return <section className="starter-library" aria-labelledby="starter-library-title">
    <h2 id="starter-library-title">Стартовые материалы</h2>
    <label>Ситуация<select value={scene} onChange={event => chooseScene(event.target.value)}>
      {starterScenes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select></label>
    <div className="level-tabs" role="group" aria-label="Уровень диалога">
      {levels.map(value => <button type="button" key={value} aria-pressed={value === level} onClick={() => chooseLevel(value)}>{value}</button>)}
    </div>
    <StarterLesson key={resource.id} lesson={{ resource, source, questions, notes }} onNext={() => {
      const next = starterScenes[(starterScenes.findIndex(item => item.id === scene) + 1) % starterScenes.length];
      chooseScene(next.id);
    }} onPractice={async () => {
      if (await update(current => ({ ...current, resources: upsert(current.resources, resource) }))) practice(resource.id);
    }} />
    <details className="fold" onToggle={event => setOriginalOpen(event.currentTarget.open)}>
      <summary>Оригинальная речь преподавателей · урок 20:30</summary>
      {originalOpen && <>
        <label>Фрагмент<select value={clipIndex} onChange={event => chooseClip(Number(event.target.value))}>
          {teacherListening.map((item, i) => <option key={item.start} value={i}>{item.title} · {item.time}</option>)}
        </select></label>
        <LessonAudio key={clip.start} language="en" lesson="lesson-2" cues={[{ ...clip, label: clip.title }]} />
        <ol>{clip.questions.map(([question, answer]) => <li key={question}>
          <p lang="en">{question}</p><Fold title="Показать ответ"><p lang="en">{answer}</p></Fold>
        </li>)}</ol>
      </>}
    </details>
  </section>;
}

function StarterLesson({ lesson, onPractice, onNext }: { lesson: Pick<(typeof starterLessons)[number], 'resource' | 'source' | 'questions' | 'notes'>; onPractice: () => Promise<void>; onNext: () => void }) {
  const { resource, source, questions, notes } = lesson;
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, reveal] = useState(false);
  const last = questions.length + 2;
  useEffect(() => stopSpeaking, []);
  function go(value: number) {
    stopSpeaking();
    setStep(value); setAnswer(''); reveal(false);
  }
  const question = questions[step - 2];
  return <article className="resource starter-lesson">
    <h3 lang="en">{resource.title}</h3>
    {!step ? <>
      <p className="sub">{source} Вопросы собеседника и связующие реплики составлены для практики.</p>
      <button type="button" className="primary" onClick={() => go(1)}>Начать занятие</button>
    </> : <>
      <p className="sub" role="status">Шаг {step} из {last}</p>
      {step === 1 && <section aria-label="Аудирование">
        <h4>Прослушай диалог</h4>
        <p>Попробуй уловить, о чём говорят и к чему приходят собеседники.</p>
        <VoiceButtons text={resource.text} language={resource.language} />
      </section>}
      {question && <section aria-label="Вопрос по диалогу">
        <h4 lang="en">{question[0]}</h4>
        <label>Твой ответ<textarea lang="en" rows={2} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
        <button type="button" onClick={() => reveal(true)}>Показать ответ</button>
        {revealed && <p lang="en">{question[1]}</p>}
        <Fold title="Прослушать ещё раз"><VoiceButtons text={resource.text} language={resource.language} /></Fold>
      </section>}
      {step === last && <>
        <h4>Сверься с диалогом</h4>
        <p className="source-text" lang="en" style={{ whiteSpace: 'pre-wrap' }}>{resource.text}</p>
        <Fold title="Как сказать естественнее">
          <dl>{notes.map(([phrase, note]) => <div key={phrase}><dt lang="en">{phrase}</dt><dd>{note}</dd></div>)}</dl>
        </Fold>
        <p>{resource.prompt}</p>
      </>}
      <div className="actions">
        <button type="button" onClick={() => go(step - 1)}>Назад</button>
        {step < last
          ? <button type="button" className="primary" onClick={() => go(step + 1)}>{step === 1 ? 'К вопросам →' : step === last - 1 ? 'К диалогу →' : 'Следующий вопрос →'}</button>
          : <><button type="button" className="primary" onClick={() => void onPractice()}>Разыграть диалог</button><button type="button" onClick={onNext}>Следующий материал →</button></>}
      </div>
    </>}
  </article>;
}
