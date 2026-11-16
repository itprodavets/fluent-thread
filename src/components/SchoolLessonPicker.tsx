import { useState } from 'react';
import type { Topic } from '../domain/model';
import type { DialogueLink } from '../domain/school-lessons';
import { schoolLessonGroups } from '../domain/school-lessons';
import datedLessons from '../../materials/2026-11-16/lessons.json';

const emptyDialogues = new Map<string, DialogueLink[]>();
const dates = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function SchoolLessonPicker({ topics, selected, choose, dialogues = emptyDialogues, due }: {
  topics: Topic[]; selected?: string; choose: (topicId: string, dialogueId?: string) => void;
  dialogues?: ReadonlyMap<string, DialogueLink[]>; due?: (topic: Topic) => boolean;
}) {
  const [query, setQuery] = useState('');
  const groups = schoolLessonGroups(topics, datedLessons, dialogues, query);
  return <section className="school-lessons" aria-label="Занятия по школам">
    <label>{dialogues.size ? 'Найти школу, занятие или диалог' : 'Найти школу или занятие'}
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    {!groups.length && <p className="sub" role="status">Ничего не найдено.</p>}
    <div className="school-lesson-groups">
      {groups.map(({ school, lessons }) => <section key={school}>
        <h3>{school}</h3>
        <div className="school-lesson-list">
          {lessons.map(({ topic, source, matches }) => <div key={topic.id}>
            <button className="school-lesson-choice" type="button" aria-pressed={selected === topic.id}
              onClick={() => choose(topic.id)}>{source?.date ? topic.title.replace(/ · \d{1,2} [а-яё]+$/iu, '') : topic.title}
              {source?.date && <small>{dates.format(new Date(source.date + 'T00:00:00Z'))}</small>}
              {due?.(topic) && <small>Есть фразы к повторению</small>}
            </button>
            {!!matches.length && <ul className="school-dialogue-results" aria-label={'Диалоги · ' + topic.title}>
              {matches.map(dialogue => <li key={dialogue.id}><button type="button" onClick={() => choose(topic.id, dialogue.id)}>{dialogue.title}</button></li>)}
            </ul>}
          </div>)}
        </div>
      </section>)}
    </div>
  </section>;
}
