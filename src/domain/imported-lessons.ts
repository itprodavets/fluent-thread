import type { Resource, Study } from './model';

export function importedLessonsFor(study: Study) {
  const active = study.resources.filter(item => item.language === study.language);
  const byId = new Map(active.map(item => [item.id, item]));
  const groups = study.importedLessons ?? [];
  const grouped = new Set(groups.flatMap(group => group.resourceIds));
  const lesson = (id: string, topicId: string, title: string, entries: Resource[]) => {
    const resource = entries.find(item => item.kind === 'dialogue' && item.text);
    if (!resource) return [];
    const questions: [string, string][] = entries.filter(item => item.kind === 'exercise' && item.prompt && item.answer)
      .map(item => [item.prompt, item.answer]);
    return [{ id, topicId, title, resource, questions }];
  };
  return [
    ...[...groups].reverse().flatMap(group => lesson(group.id, group.topicId, group.title, group.resourceIds.flatMap(id => byId.get(id) ?? []))),
    ...study.topics.filter(topic => topic.language === study.language).flatMap(topic => {
      const entries = active.filter(item => item.topicId === topic.id && !grouped.has(item.id));
      return entries.filter(item => item.kind === 'dialogue').flatMap(item =>
        lesson(item.id, topic.id, item.title, [item, ...entries.filter(entry => entry.kind === 'exercise')]));
    })
  ];
}
