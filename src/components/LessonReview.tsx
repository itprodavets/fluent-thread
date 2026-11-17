import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context';
import { assessTeacherPhrase } from '../domain/lesson-practice';
import { lessonReviewDue, lessonReviewQueue } from '../domain/lesson-review';
import type { Topic, Word } from '../domain/model';
import { stopSpeaking } from '../domain/voice.js';
import { Heading, VoiceButtons } from './common';
import { WordExamples } from './WordExamples';

const nextReviewDate = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const sources = (topics: Topic[]) => topics.map(topic => topic.title).join(' · ');

function ReviewCard({ word, topics, refresh }: { word: Word; topics: Topic[]; refresh: (now: number) => void }) {
  const { update } = useWorkspace();
  const [revealed, reveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const prompt = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    prompt.current?.focus({ preventScroll: true });
    return stopSpeaking;
  }, []);

  async function score(result: 'independent' | 'retry') {
    if (saving) return;
    setSaving(true);
    const now = Date.now();
    try {
      if (await update(current => {
        const due = lessonReviewDue(current.results[word.id]);
        return due !== undefined && due <= now ? assessTeacherPhrase(current, word, result, now) : current;
      })) refresh(now);
    } finally { setSaving(false); }
  }

  return <article className="resource daily-review-card">
    <p className="sub">{sources(topics)}</p>
    <h2 ref={prompt} tabIndex={-1}>{word.meaning}</h2>
    {revealed ? <>
      <div className="lesson-recall-answer">
        <p><strong lang={word.language}>{word.title}</strong></p>
        {word.example && <p lang={word.language}>{word.example}</p>}
        <VoiceButtons text={word.title} language={word.language} />
        <WordExamples word={word} />
      </div>
      <div className="actions daily-review-actions">
        <button type="button" className="primary" disabled={saving} onClick={() => void score('independent')}>Вспомнил</button>
        <button type="button" disabled={saving} onClick={() => void score('retry')}>Ещё раз через 10 минут</button>
      </div>
    </> : <button type="button" className="primary" onClick={() => reveal(true)}>Показать ответ</button>}
  </article>;
}

export function LessonReview() {
  const { study } = useWorkspace();
  const [now, setNow] = useState(Date.now);
  const [selectedId, select] = useState('');
  const cardArea = useRef<HTMLDivElement>(null);
  const { due, nextAt } = lessonReviewQueue(study, now);
  const selected = due.find(item => item.word.id === selectedId) ?? due[0];

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = nextAt === undefined ? undefined
      : window.setTimeout(refresh, Math.min(Math.max(0, nextAt - Date.now()) + 30, 2_147_483_647));
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearTimeout(timer);
    };
  }, [nextAt]);

  return <div className="daily-review">
    <a className="back-to-today" href="#today">← Сегодня</a>
    <Heading title="Повторить сегодня" />
    <p className="sub" role="status">{due.length ? 'К повторению: ' + due.length : 'Сейчас карточек к повторению нет.'}</p>
    {selected ? <>
      <div ref={cardArea}><ReviewCard key={selected.word.id} word={selected.word} topics={selected.topics} refresh={timestamp => {
        setNow(timestamp);
        select('');
      }} /></div>
      {due.length > 1 && <section aria-labelledby="daily-review-list-title">
        <h2 id="daily-review-list-title">Очередь</h2>
        <ol className="daily-review-list">
          {due.map(({ word, topics }) => <li key={word.id}><button className="school-lesson-choice" type="button"
            aria-pressed={word.id === selected.word.id} onClick={() => {
              select(word.id);
              cardArea.current?.scrollIntoView({ block: 'start' });
            }}>
            {word.meaning}<small>{sources(topics)}</small>
          </button></li>)}
        </ol>
      </section>}
    </> : nextAt !== undefined
      ? <p>Ближайшее повторение — {nextReviewDate.format(nextAt)}.</p>
      : <p>Оцени карточку в уроке, чтобы запланировать её повторение. <a href="#materials">Открыть занятия</a></p>}
  </div>;
}
