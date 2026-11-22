import { dialogueChoices, importedLessonsFor } from './imported-lessons.ts';
import type { Study } from './model';
import { lessonSource } from './school-lessons.ts';
import type { DatedLesson } from './school-lessons';
import type { Skill } from './skill-dialogues';
import { starterLessons, starterScenes } from './starter-materials.ts';

export type MaterialRoute = { topicId: string; resourceId?: string; skillId?: string; malformed?: boolean };
export type MaterialSelection = { topicId?: string; resourceId?: string; skillId?: string; notice?: string };

export function materialLessonHref(topicId: string, resourceId?: string, skillId?: string): string {
  const query = new URLSearchParams();
  if (resourceId) query.set('resource', resourceId);
  if (skillId) query.set('skill', skillId);
  return '#materials/lesson/' + encodeURIComponent(topicId) + (query.size ? '?' + query.toString() : '');
}

export function parseMaterialRoute(hash: string): MaterialRoute | undefined {
  const prefix = '#materials/lesson/';
  if (!hash.startsWith(prefix)) return undefined;
  const [path, ...rest] = hash.slice(prefix.length).split('?');
  try {
    // URLSearchParams alone silently repairs broken percent escapes. Reject those instead.
    const query = rest.join('?');
    decodeURIComponent(query.replace(/\+/g, ' '));
    const params = new URLSearchParams(query);
    return { topicId: decodeURIComponent(path), resourceId: params.get('resource') || undefined,
      skillId: params.get('skill') || undefined };
  } catch {
    // A broken query must not lose an otherwise valid topic boundary.
    try { return { topicId: decodeURIComponent(path), malformed: true }; }
    catch { return { topicId: '', malformed: true }; }
  }
}

/** Resolve presentation state only: opening a route never writes learning progress. */
export function resolveMaterialRoute(study: Study, route: MaterialRoute, skills: Skill[], dated: DatedLesson[]): MaterialSelection {
  const topic = study.topics.find(item => item.id === route.topicId && item.language === study.language);
  const starter = !topic && study.language === 'en' && starterScenes.some(item => item.id === route.topicId);
  if (!topic && !starter) return { notice: 'Занятие недоступно на текущем языке. Выбери занятие.' };
  const lessons = importedLessonsFor(study);
  const versions = lessons.filter(item => item.topicId === route.topicId);
  const starterVersions = starter ? starterLessons.filter(item => item.sceneId === route.topicId) : [];
  const exact = versions.find(item => item.id === route.resourceId);
  const exactStarter = starterVersions.find(item => item.resource.id === route.resourceId);
  const first = dialogueChoices(versions)[0];
  const fallback = first?.versions.find(item => item.level === 'B2') ?? first?.versions[0];
  const resourceId = exact?.id ?? exactStarter?.resource.id ?? fallback?.id ?? starterVersions[0]?.resource.id;
  const selection: MaterialSelection = { topicId: route.topicId, resourceId };
  if (route.malformed || (route.resourceId && !exact && !exactStarter)) {
    selection.notice = 'Указанная версия диалога недоступна. Открыты доступные материалы этого занятия.';
  }
  if (route.skillId) {
    const skill = study.language === 'en' && skills.find(item => item.id === route.skillId);
    const school = topic && lessonSource(topic, dated)?.school;
    const matches = skill && exact && skill.dialogues.filter(item => item.school === school && item.title === exact.title);
    // A repeated school/scene title must not turn into a guessed skill association.
    const candidates = exact && study.topics.filter(item => item.language === study.language).flatMap(item =>
      lessonSource(item, dated)?.school === school
        ? dialogueChoices(lessons.filter(lesson => lesson.topicId === item.id)).filter(choice => choice.title === exact.title) : []);
    if (matches && matches.length === 1 && candidates?.length === 1) selection.skillId = route.skillId;
    else selection.notice = [selection.notice, 'Контекст навыка недоступен для этого диалога.'].filter(Boolean).join(' ');
  }
  return selection;
}
