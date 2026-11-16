import type { PhraseCard } from './lesson-practice';
import type { Topic } from './model';
import { lessonSource } from './school-lessons.ts';
import type { DatedLesson, DialogueLink } from './school-lessons';

export type Skill = { id: string; title: string; dialogues: SkillDialogue[] };
type SkillDialogue = { school: string; title: string; prompt: string; answer: string; role: { line: string; patterns: string[] }; phrases: (PhraseCard & { origin: string })[] };
export type SkillMatch = SkillDialogue & { topicId: string; dialogueId: string };

export function skillMatches(skill: Skill, topics: Topic[], dated: DatedLesson[], dialogues: ReadonlyMap<string, DialogueLink[]>): SkillMatch[] {
  return skill.dialogues.flatMap(entry => topics.flatMap(topic => {
    if (lessonSource(topic, dated)?.school !== entry.school) return [];
    const dialogue = dialogues.get(topic.id)?.find(item => item.title === entry.title);
    return dialogue ? [{ ...entry, topicId: topic.id, dialogueId: dialogue.id }] : [];
  }));
}

export function skillPhraseCards(matches: SkillMatch[], preferred?: SkillMatch) {
  const ordered = preferred ? [preferred, ...matches.filter(match => match.dialogueId !== preferred.dialogueId)] : matches;
  return ordered.flatMap(match => match.phrases.map(card => ({ ...card, topicId: match.topicId,
    source: match.school + ' · ' + match.title + ' · ' + card.origin })));
}
