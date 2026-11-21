import { useEffect, useState } from 'react';
import { useWorkspace } from '../context';
import { dialogueMistakes } from '../domain/dialogue-mistakes';
import { skillPhrasesHash } from '../domain/lesson-practice';
import { reviewCue } from '../domain/skill-answer';
import { Fold } from './common';
import { MistakeCorrections, SkillReply } from './SkillReply';
import { addLessonMistakes, availableLessonMistakes } from '../domain/lesson-mistakes';
import { lessonMistakePacks } from '../domain/lesson-mistake-catalog';

const dates = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function DialogueMistakeReview() {
  const { study, update } = useWorkspace();
  const [adding, setAdding] = useState(false);
  const available = availableLessonMistakes(study, lessonMistakePacks);
  const [now, setNow] = useState(Date.now);
  const [selected, choose] = useState<string>();
  const { all, due } = dialogueMistakes(study, now);
  const current = all.find(card => card.id === selected) ?? due[0];
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => { if (!selected && due[0]) choose(due[0].id); }, [selected, due[0]?.id]);

  return <section className="dialogue-mistakes" aria-label="Повторение ошибок в диалогах">
    <h2>Ошибки в диалогах</h2>
    <p className="sub" role="status">К повторению: {due.length} · Сохранено: {all.length}</p>
    {!!available.length && <div className="resource">
      <h3>Разобранные ошибки из твоих уроков</h3>
      <p>Ситуации, исправления и пункты для самостоятельной проверки из записей 20 ноября. Неуверенные слова распознавания не назначены как личные ошибки.</p>
      <button type="button" className="primary" disabled={adding} onClick={async () => {
        setAdding(true);
        try { if (await update(current => addLessonMistakes(current, lessonMistakePacks, Date.now()))) setNow(Date.now()); }
        finally { setAdding(false); }
      }}>Добавить в повторение · {available.length}</button>
    </div>}
    {!!all.length && <p><a href="#today/review">Открыть общую очередь «Повторить сегодня» →</a></p>}
    {!all.length && <p>Здесь появятся ошибки после проверки ответа. <a href={skillPhrasesHash}>Открыть занятия по навыкам</a></p>}
    {!!due.length && <div className="material-choice-grid" role="group" aria-label="Ситуации к повторению">
      {due.map(card => <button type="button" key={card.id} aria-pressed={card.id === current?.id} onClick={() => choose(card.id)}>
        <strong>{card.scenario.title}</strong><small>{card.reviewMode === 'self-check' ? card.checklist?.[0] : reviewCue(card.correction.rule)}</small>
      </button>)}
    </div>}
    {current ? <article className="resource">
      <p className="sub">{current.scenario.school} · {current.scenario.title}</p>
      <SkillReply key={current.id} exercise={current.scenario} mistake={current} recordingId={'dialogue-review:' + current.id} />
    </article> : !!all.length && <p>Ближайшее повторение — {dates.format(all[0].due)}.</p>}
    {!!all.length && <Fold title="Все сохранённые ошибки">
      {all.map(card => <Fold key={card.id} title={card.scenario.title + ' · ' + dates.format(card.due)}>
        <p className="source-text" lang="en">{card.original}</p>
        <MistakeCorrections mistake={card} />
        {card.last && <><h4>Твой последний ответ</h4><p lang="en">{card.last.answer}</p></>}
      </Fold>)}
    </Fold>}
  </section>;
}
