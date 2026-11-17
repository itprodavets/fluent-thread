import type { Resource, Study } from './model';
import { levels } from './starter-materials.ts';
import type { Level } from './starter-materials.ts';

export function dialogueVersion(title: string): { title: string; level?: Level } {
  const match = /^(.*?)\s*[·–—:]\s*(A1|A2|B1|B2|C1|C2)\s*$/iu.exec(title);
  return match ? { title: match[1].trim(), level: match[2].toUpperCase() as Level } : { title };
}

export function importedLessonsFor(study: Study) {
  const active = study.resources.filter(item => item.language === study.language);
  const groups = [...(study.importedLessons ?? [])].reverse();
  const lessons = study.topics.filter(topic => topic.language === study.language).flatMap(topic => {
    const entries = active.filter(item => item.topicId === topic.id);
    const exercises = entries.filter(item => item.kind === 'exercise' && item.prompt && item.answer);
    return entries.filter(item => item.kind === 'dialogue' && item.text).map(resource => {
      const version = dialogueVersion(resource.title);
      const groupOrder = groups.findIndex(group => group.resourceIds.includes(resource.id));
      const group = groups[groupOrder];
      const ownQuestions = exercises.filter(item => item.title === 'Чтение и ответ · ' + resource.title);
      const sharedQuestions = exercises.filter(item => !item.title.startsWith('Чтение и ответ · ') &&
        (!group || group.resourceIds.includes(item.id)));
      const questions: [string, string][] = (ownQuestions.length ? ownQuestions : sharedQuestions).map(item => [
        item.prompt!.startsWith(resource.text + '\n\n') ? item.prompt!.slice(resource.text.length).trimStart() : item.prompt!,
        item.answer!
      ]);
      return { id: resource.id, topicId: topic.id, resource, ...version, questions, groupOrder };
    });
  });
  return lessons.sort((a, b) => (a.groupOrder < 0 ? Infinity : a.groupOrder) - (b.groupOrder < 0 ? Infinity : b.groupOrder));
}

export function dialogueChoices(lessons: ReturnType<typeof importedLessonsFor>) {
  const choices = new Map<string, { title: string; versions: typeof lessons }>();
  for (const lesson of lessons) {
    const key = lesson.level ? lesson.title.toLocaleLowerCase() : lesson.id;
    const choice = choices.get(key) ?? { title: lesson.title, versions: [] };
    if (choice.versions.some(version => version.level === lesson.level)) {
      choices.set(lesson.id, { title: lesson.resource.title, versions: [lesson] });
    } else {
      choice.versions.push(lesson);
      choices.set(key, choice);
    }
  }
  for (const choice of choices.values()) {
    choice.versions.sort((a, b) => levels.indexOf(a.level!) - levels.indexOf(b.level!));
  }
  return [...choices.values()];
}
