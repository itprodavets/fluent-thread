import { teacherListening } from '../domain/teacher-listening';
import { LessonAudio } from './LessonAudio';
import { useState } from 'react';
import { useWorkspace } from '../context';
import { upsert } from '../domain/model';
import { levels, starterLessons, starterScenes } from '../domain/starter-materials';
import type { Level } from '../domain/starter-materials';
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
    <article className="resource starter-lesson" key={resource.id}>
      <h3 lang="en">{resource.title}</h3>
      <p className="sub">{source} Вопросы собеседника и связующие реплики составлены для практики.</p>
      <section aria-label="Аудирование">
        <h4>Аудирование</h4>
        <p>Прослушай озвученный диалог до открытия текста. Ответь на вопросы 1–2, затем послушай ещё раз и ответь на остальные.</p>
        <VoiceButtons text={resource.text} language={resource.language} />
        <ol>{questions.map(([question, answer]) => <li key={question}>
          <p lang="en">{question}</p>
          <Fold title="Показать ответ"><p lang="en">{answer}</p></Fold>
        </li>)}</ol>
      </section>
      <Fold title="Читать диалог"><p className="source-text" lang="en" style={{ whiteSpace: 'pre-wrap' }}>{resource.text}</p></Fold>
      <Fold title="Как сказать естественнее">
        <dl>{notes.map(([phrase, note]) => <div key={phrase}><dt lang="en">{phrase}</dt><dd>{note}</dd></div>)}</dl>
      </Fold>
      <p>{resource.prompt}</p>
      <button type="button" className="primary" onClick={async () => {
        if (await update(current => ({ ...current, resources: upsert(current.resources, resource) }))) practice(resource.id);
      }}>Разыграть диалог</button>
    </article>
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
