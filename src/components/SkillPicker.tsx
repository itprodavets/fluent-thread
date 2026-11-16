import type { Skill, SkillMatch } from '../domain/skill-dialogues';
import { lessonPhrasesHash } from '../domain/lesson-practice';

export function SkillPicker({ skills, selected, matches, selectedTopic, selectedDialogue, change, open }: {
  skills: Skill[]; selected: string; matches: SkillMatch[]; selectedTopic: string; selectedDialogue?: string;
  change: (id: string) => void; open: (match: SkillMatch) => void;
}) {
  return <section className="skill-picker" aria-label="Диалоги по навыкам">
    <div className="skill-options" role="group" aria-label="Навык">
      {skills.map(skill => <button key={skill.id} type="button" aria-pressed={selected === skill.id}
        onClick={() => change(skill.id)}>{skill.title}</button>)}
    </div>
    {matches.length ? <ul className="skill-dialogues">
      {matches.map(match => <li key={match.dialogueId}>
        <button type="button" aria-pressed={match.topicId === selectedTopic && match.title === selectedDialogue}
          onClick={() => open(match)}>
          <small>{match.school}</small>
          {match.title}
        </button>
      </li>)}
    </ul> : <p className="sub">Добавь занятия от 16 ноября, чтобы открыть диалоги. <a href={lessonPhrasesHash}>Загрузить занятия</a></p>}
  </section>;
}
