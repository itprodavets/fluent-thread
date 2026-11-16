import type { ReactNode } from 'react';
import { ReadableMaterial } from './ReadableMaterial';
import { teacherListening } from '../domain/teacher-listening';
import { LessonAudio } from './LessonAudio';
import { useEffect, useState } from 'react';
import { useWorkspace } from '../context';
import type { Resource } from '../domain/model';
import { SpokenRole } from './SpokenRole';
import { levels, starterLessons, starterScenes } from '../domain/starter-materials';
import type { Level } from '../domain/starter-materials';
import { stopSpeaking } from '../domain/voice.js';
import { Fold, VoiceButtons } from './common';

export function StarterMaterials({ scene, chooseScene }: { scene: string; chooseScene: (scene: string) => void }) {
  const { study } = useWorkspace();
  const [level, chooseLevel] = useState<Level>('A1');
  if (study.language !== 'en') return null;
  const { resource, source, questions, notes } = starterLessons.find(item => item.sceneId === scene && item.level === level)!;
  return <section className="starter-library" aria-labelledby="starter-library-title">
    <h2 id="starter-library-title">Стартовые материалы</h2>
    <div className="level-tabs" role="group" aria-label="Уровень диалога">
      {levels.map(value => <button type="button" key={value} aria-pressed={value === level} onClick={() => chooseLevel(value)}>{value}</button>)}
    </div>
    <StarterLesson key={resource.id} lesson={{ resource, source: source + ' Вопросы собеседника и связующие реплики составлены для практики.', questions, notes }} onNext={() => {
      const next = starterScenes[(starterScenes.findIndex(item => item.id === scene) + 1) % starterScenes.length];
      chooseScene(next.id);
    }} />
  </section>;
}

export function TeacherAudioCard() {
  const [clipIndex, chooseClip] = useState(0);
  const clip = teacherListening[clipIndex];
  return <article className="resource">
    <h2>Оригинальная речь преподавателей</h2>
    <p className="sub">Урок 20:30 · {teacherListening.length} фрагментов с вопросами</p>
    <label>Фрагмент<select value={clipIndex} onChange={event => chooseClip(Number(event.target.value))}>
      {teacherListening.map((item, i) => <option key={item.start} value={i}>{item.title} · {item.time}</option>)}
    </select></label>
    <LessonAudio key={clip.start} language="en" lesson="lesson-2" cues={[{ ...clip, label: clip.title }]} />
    <ol>{clip.questions.map(([question, answer]) => <li key={question}>
      <p lang="en">{question}</p><Fold title="Показать ответ"><p lang="en">{answer}</p></Fold>
    </li>)}</ol>
  </article>;
}

export function StarterLesson({ lesson, onNext, firstExercise }: { lesson: { resource: Resource; source: string; questions: [string, string][]; notes: [string, string][] }; onNext?: () => void; firstExercise?: ReactNode }) {
  const { resource, source, questions, notes } = lesson;
  const [step, setStep] = useState(1);
  const [answer, setAnswer] = useState('');
  const [revealed, reveal] = useState(false);
  const firstQuestion = firstExercise ? 2 : 1;
  const last = questions.length + firstQuestion;
  useEffect(() => stopSpeaking, []);
  function go(value: number) {
    stopSpeaking();
    setStep(value); setAnswer(''); reveal(false);
  }
  const question = questions[step - firstQuestion];
  return <article className="resource starter-lesson">
    <h3 lang="en">{resource.title}</h3>
    {source && <p className="sub">{source}</p>}
    <p className="sub" role="status">Шаг {step} из {last}</p>
    <section aria-labelledby="lesson-dialogue-title">
      <h4 id="lesson-dialogue-title">Диалог для чтения и аудирования</h4>
      <VoiceButtons text={resource.text} language={resource.language} />
      <ReadableMaterial text={resource.text} language={resource.language} translation={resource.translation} dialogue notes={notes} />
    </section>
    {step === 1 && firstExercise}
    {question && <section aria-label="Вопрос по диалогу">
      <h4 lang="en">{question[0]}</h4>
      <label>Твой ответ<textarea lang="en" rows={2} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
      <button type="button" onClick={() => reveal(true)}>Показать ответ</button>
      {revealed && <p lang="en">{question[1]}</p>}
    </section>}
    {step === last && <>
      {!!notes.length && <Fold title="Как сказать естественнее">
        <dl>{notes.map(([phrase, note]) => <div key={phrase}><dt lang="en">{phrase}</dt><dd>{note}</dd></div>)}</dl>
      </Fold>}
      <h4>Разыграй свою роль</h4>
      <p>{resource.prompt || 'Выбери участника. Слушай реплики собеседника и отвечай своими словами. Запиши свою версию.'}</p>
      <SpokenRole resource={resource} />
    </>}
    <div className="actions">
      {step > 1 && <button type="button" onClick={() => go(step - 1)}>Назад</button>}
      {step < last
        ? <button type="button" className="primary" onClick={() => go(step + 1)}>{step === last - 1 ? 'К своей роли →' : 'Следующий вопрос →'}</button>
        : onNext && <button type="button" className="primary" onClick={onNext}>Следующий материал →</button>}
    </div>
  </article>;
}
