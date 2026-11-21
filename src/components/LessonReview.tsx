import { materialRecallContent } from '../domain/material-review';
import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context';
import { assessTeacherPhrase } from '../domain/lesson-practice';
import { lessonReviewDue, lessonReviewQueue } from '../domain/lesson-review';
import type { Topic, Word } from '../domain/model';
import { stopSpeaking } from '../domain/voice.js';
import { Heading, VoiceButtons, SourceLink } from './common';
import { MaterialReview } from './MaterialReview';
import { ReadableMaterial } from './ReadableMaterial';
import type { Resource } from '../domain/model';
import { WordExamples } from './WordExamples';
import { SkillReply } from './SkillReply';
import type { DialogueMistake } from '../domain/dialogue-mistakes';
import { mistakeReviewMoved } from '../domain/dialogue-mistakes';

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

function MaterialReviewCard({ resource, topics, refresh }: { resource: Resource; topics: Topic[]; refresh: (now:number) => void }) {
  const [revealed,reveal] = useState(false);
  const [answer,setAnswer] = useState('');
  const content = materialRecallContent(resource);
  return <article className="resource daily-review-card">
    <p className="sub">{sources(topics)}</p><h2>{resource.title}</h2>
    <p className="source-text">{resource.prompt || (resource.kind === 'dialogue' ? 'Разыграй диалог своими словами.' : 'Вспомни основные мысли и перескажи своими словами.')}</p>
    {content.passage && <p className="source-text" lang={resource.language}>{content.passage}</p>}
    <label>Твой ответ<textarea value={answer} onChange={event => setAnswer(event.target.value)} rows={3} lang={resource.language} /></label>
    {revealed ? <><SourceLink url={content.url} /><ReadableMaterial text={content.reference} language={resource.language} translation={resource.translation} dialogue={resource.kind === 'dialogue'} /><MaterialReview resource={resource} onRated={refresh} /></>
      : <button type="button" className="primary" onClick={() => reveal(true)}>Показать ответ</button>}
  </article>;
}

export function LessonReview() {
  const { study } = useWorkspace();
  const [now, setNow] = useState(Date.now);
  const [selectedId, select] = useState('');
  const cardArea = useRef<HTMLDivElement>(null);
  const { all: due, nextAt } = lessonReviewQueue(study, now);
  type MistakeItem = Extract<typeof due[number], {kind:'mistake'}>;
  const [heldMistake, holdMistake] = useState<MistakeItem>();
  const itemId = (item: typeof due[number]) => item.kind === 'word' ? item.word.id : item.kind === 'material' ? item.resource.id : 'mistake:' + item.mistake.id;
  const itemTitle = (item: typeof due[number]) => item.kind === 'word' ? item.word.meaning : item.kind === 'material' ? item.resource.title : item.mistake.scenario.title;
  const candidate = due.find(item => itemId(item) === selectedId) ?? due[0];
  const selected = heldMistake ?? candidate;
  // Keep the checked answer visible after its due date moves out of the queue.
  useEffect(() => { if (!heldMistake && candidate?.kind === 'mistake') holdMistake(candidate); }, [heldMistake, candidate]);

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
      <div ref={cardArea}>{selected.kind === 'word'
        ? <ReviewCard key={selected.word.id} word={selected.word} topics={selected.topics} refresh={timestamp => { setNow(timestamp); select(''); }} />
        : selected.kind === 'material'
          ? <MaterialReviewCard key={selected.resource.id} resource={selected.resource} topics={selected.topics} refresh={timestamp => { setNow(timestamp); select(''); }} />
          : <MistakeReviewCard key={selected.mistake.id} mistake={selected.mistake} next={() => { holdMistake(undefined); select(''); setNow(Date.now()); }} />}</div>
      {due.length > 1 && <section aria-labelledby="daily-review-list-title">
        <h2 id="daily-review-list-title">Очередь</h2>
        <ol className="daily-review-list">
          {due.map(item => <li key={itemId(item)}><button className="school-lesson-choice" type="button"
            aria-pressed={itemId(item) === itemId(selected)} onClick={() => {
              select(itemId(item));
              holdMistake(undefined);
              cardArea.current?.scrollIntoView({ block: 'start' });
            }}>
            {itemTitle(item)}<small>{sources(item.topics) || (item.kind === 'mistake' ? item.mistake.scenario.school : '')}</small>
          </button></li>)}
        </ol>
      </section>}
    </> : nextAt !== undefined
      ? <p>Ближайшее повторение — {nextReviewDate.format(nextAt)}.</p>
      : <p>Оцени карточку в уроке, чтобы запланировать её повторение. <a href="#materials">Открыть занятия</a></p>}
  </div>;
}

function MistakeReviewCard({ mistake, next }: { mistake: DialogueMistake; next: () => void }) {
  const { study } = useWorkspace();
  const [reviewed, setReviewed] = useState(false);
  const removed = !study.dialogueMistakes?.[mistake.id];
  const moved = mistakeReviewMoved(study, mistake.id, Date.now());
  return <article className="resource daily-review-card">
    <p className="sub">{mistake.scenario.school}</p><h2>{mistake.scenario.title}</h2>
    {removed ? <p role="status">Эта карточка уже удалена из профиля.</p>
      : <SkillReply exercise={mistake.scenario} mistake={mistake} recordingId={'dialogue-review:' + mistake.id} onReviewed={() => setReviewed(true)} />}
    {moved && !reviewed && !removed && <p className="sub">Срок повторения уже обновлён в профиле. Можно перейти дальше.</p>}
    {(reviewed || moved) && <button type="button" className="primary" onClick={next}>Следующая карточка →</button>}
  </article>;
}
