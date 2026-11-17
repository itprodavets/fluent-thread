import { useEffect, useState } from 'react';
import { useWorkspace } from '../context';
import { applyChatPackage, parseChatPackage } from '../domain/chat-package.js';
import { lessonPractice, teacherPhraseReviews } from '../domain/lesson-practice';
import { LessonPractice } from './LessonPractice';
import { SchoolLessonPicker } from './SchoolLessonPicker';

const datedLessons = [
  { title: 'Разговорный английский с Bruce · 17 ноября', load: () => import('../../materials/2026-11-17/dcpl-conversation.json?raw') },
  { title: 'Волки, экосистемы и экодом · 16 ноября', load: () => import('../../materials/2026-11-16/wolves-and-eco-homes.json?raw') },
  { title: 'Планы и договорённости по-английски · 16 ноября', load: () => import('../../materials/2026-11-16/future-plans.json?raw') },
  { title: 'Короткие ответы, мнения и разговор о себе · 16 ноября', load: () => import('../../materials/2026-11-16/responses-and-opinions.json?raw') }
];

export function PhraseTopics() {
  const { study, active, update, notify } = useWorkspace();
  const [selection, select] = useState('');
  const [loading, setLoading] = useState('');
  const topics = active.topics.filter(topic => Object.values(lessonPractice(active.resources, topic.id)).some(list => list.length));
  const missing = study.language === 'en' ? datedLessons.filter(item => {
    const topic = topics.find(entry => entry.title === item.title);
    return !topic || Object.values(lessonPractice(active.resources, topic.id)).some(list => !list.length);
  }) : [];
  const [now, setNow] = useState(Date.now);
  const { due, pending } = teacherPhraseReviews(study, now);
  const selected = topics.find(topic => topic.id === selection)
    ?? topics.find(topic => topic.links.some(id => due.has(id))) ?? topics[0];
  useEffect(() => {
    if (!pending.size) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [pending.size]);

  async function add(item: typeof datedLessons[number]) {
    setLoading(item.title);
    try {
      const packet = parseChatPackage((await item.load()).default);
      let id = '';
      const saved = await update(current => {
        if (current.language !== packet.language) return current;
        const existing = current.topics.find(topic => topic.language === packet.language && topic.title === packet.topic.title);
        const supplement = existing ? {
          ...packet,
          materials: packet.materials.filter(material => /^(Реплики преподавателя|Грамматика урока|Грамматика) ·/u.test(material.title))
        } : packet;
        const result = applyChatPackage(current, supplement, existing?.id);
        id = result.topic.id;
        return result.next;
      });
      if (saved) select(id);
    } catch {
      notify('Не удалось загрузить материалы. Попробуй ещё раз.');
    } finally {
      setLoading('');
    }
  }

  return <section className="phrase-topics" aria-label="Фразы и грамматика по урокам">
    {!!topics.length && <>
      <SchoolLessonPicker topics={topics} selected={selected?.id} choose={select} due={topic => topic.links.some(id => due.has(id))} />
      {selected && <LessonPractice key={selected.id} resources={active.resources} topicId={selected.id} openPhrases />}
    </>}
    {!!missing.length && <div className="phrase-topic-imports">
      <h2>Загрузить уроки</h2>
      <p className="sub">Загрузи материалы в этот браузер, чтобы читать их и сохранять отметки.</p>
      <div className="material-choice-grid">{missing.map(item => <button type="button" key={item.title} disabled={!!loading}
        onClick={() => void add(item)}>{loading === item.title ? 'Загружаем…' : item.title}</button>)}</div>
    </div>}
    {!topics.length && !missing.length && <p className="sub">Фразы и грамматика появятся здесь после импорта материалов урока.</p>}
    {!!pending.size && <p className="sub">Отложенные фразы появятся здесь, когда подойдёт время повторения.</p>}
  </section>;
}
