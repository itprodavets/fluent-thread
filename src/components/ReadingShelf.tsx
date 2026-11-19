import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Resource, Topic } from '../domain/model';
import { dialogueVersion } from '../domain/imported-lessons';
import { lessonCues } from '../domain/lesson-cues';
import { levels, starterLessons } from '../domain/starter-materials';

const sections = [
  { id: 'reading', label: 'Тексты' },
  { id: 'dialogue', label: 'Диалоги' },
  { id: 'transcript', label: 'Расшифровки' },
] as const;
type Section = typeof sections[number]['id'];

function sectionOf(resource: Resource): Section | undefined {
  if (lessonCues(resource.text).length || resource.title.startsWith('Разбор записи ·')) return 'transcript';
  if (resource.kind === 'reading' || resource.kind === 'dialogue') return resource.kind;
}

export function ReadingShelf({ resources, topics, language, read, openLesson, lessonTopics, loadButton }: {
  resources: Resource[];
  topics: Topic[];
  language: string;
  read: (resource: Resource) => ReactNode;
  openLesson: (topicId: string, dialogueId?: string) => void;
  lessonTopics: Topic[];
  loadButton: ReactNode;
}) {
  const [section, setSection] = useState<Section>('reading');
  const [query, setQuery] = useState('');
  const [selected, select] = useState<Resource>();
  const heading = useRef<HTMLHeadingElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const lastOpened = useRef('');
  const selectedTopic = topics.find(topic => topic.id === selected?.topicId);
  const starter = selected && starterLessons.find(lesson => lesson.resource.id === selected.id);
  const entries = resources.concat(language === 'en' ? starterLessons.map(lesson => lesson.resource) : []);
  const groups = new Map<string, { title: string; resources: Resource[] }>();
  for (const resource of entries) {
    if (!resource.text.trim() || sectionOf(resource) !== section) continue;
    const { title, level } = section === 'dialogue' || section === 'reading'
      ? dialogueVersion(resource.title) : { title: resource.title, level: undefined };
    const key = level ? JSON.stringify([resource.topicId, title.toLocaleLowerCase()]) : resource.id;
    const group = groups.get(key);
    if (!group) groups.set(key, { title, resources: [resource] });
    else if (group.resources.some(item => dialogueVersion(item.title).level === level)) {
      groups.set(resource.id, { title: resource.title, resources: [resource] });
    } else group.resources.push(resource);
  }
  const selectedGroup = selected && [...groups.values()].find(group => group.resources.some(item => item.id === selected.id));
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = [...groups.values()].filter(group => {
    const topic = topics.find(item => item.id === group.resources[0].topicId);
    const context = [group.title, topic?.title, topic?.source?.school, ...group.resources.map(item => item.title)]
      .join(' ').toLocaleLowerCase();
    return terms.every(term => context.includes(term));
  });
  function focus(ref: { current: HTMLElement | null }) {
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.scrollIntoView({ block: 'start' }); });
  }
  if (selected) return <div className="reading-shelf">
    <div className="actions">
      <button type="button" onClick={() => { select(undefined); focus(back); }}>← К списку текстов</button>
      {starter && <button type="button" onClick={() => openLesson(starter.sceneId, starter.resource.id)}>К занятию</button>}
      {selectedTopic && lessonTopics.some(topic => topic.id === selectedTopic.id) &&
        <button type="button" onClick={() => openLesson(selectedTopic.id, selected.kind === 'dialogue' ? selected.id : undefined)}>К занятию</button>}
    </div>
    <article className="resource reading-document">
      {selectedTopic && <p className="sub">{selectedTopic.title}</p>}
      <h2 tabIndex={-1} ref={heading}>{selectedGroup?.title ?? selected.title}</h2>
      {selectedGroup && selectedGroup.resources.length > 1 && <div className="level-tabs" role="group" aria-label={selected.kind === 'dialogue' ? 'Уровень диалога' : 'Уровень текста'}>
        {levels.map(level => {
          const version = selectedGroup.resources.find(item => dialogueVersion(item.title).level === level);
          return version && <button type="button" key={version.id} aria-pressed={selected.id === version.id}
            onClick={() => select(version)}>{level}</button>;
        })}
      </div>}
      {read(selected)}
    </article>
  </div>;
  return <section className="reading-shelf" aria-label="Материалы для чтения">
    <div className="practice-modes" role="group" aria-label="Вид текста">
      {sections.map(item => <button type="button" key={item.id} aria-pressed={section === item.id}
        onClick={() => setSection(item.id)}>{item.label}</button>)}
    </div>
    <label>Найти по названию, теме или школе
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    {loadButton && <div>{loadButton}</div>}
    {results.length ? <ul className="reading-results">
      {results.map(group => {
        const resource = group.resources.find(item => dialogueVersion(item.title).level === 'B2') ?? group.resources[0];
        return <li key={resource.id}>
          <button ref={lastOpened.current === resource.id ? back : undefined} className="school-lesson-choice"
            type="button" onClick={() => {
              lastOpened.current = resource.id;
              select(resource);
              focus(heading);
            }}>
            {group.title}
            {resource.topicId && <small>{topics.find(topic => topic.id === resource.topicId)?.title}</small>}
          </button>
        </li>;
      })}
    </ul> : <p className="sub" role="status">{query.trim() ? 'По этому запросу ничего не найдено.' : 'В этом разделе пока нет материалов.'}</p>}
  </section>;
}
