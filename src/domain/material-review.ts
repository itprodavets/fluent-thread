import { assess } from './model.ts';
import type { Outcome, PracticeResult, Resource, Study } from './model';
import { starterLessons } from './starter-materials.ts';
export const materialRetryDelay = 10 * 60_000;
export function materialReviewDue(result?: PracticeResult) {
  return result?.schedules?.spoken?.due ?? (!result?.mode || result.mode === 'spoken' ? result?.due : undefined);
}
export function reviewResources(study: Study) {
  return [...new Map([...study.resources, ...(study.language === 'en' ? starterLessons.map(item => item.resource) : [])]
    .filter(item => item.language === study.language).map(item => [item.id,item])).values()];
}
export function assessMaterial(study: Study, resource: Resource, outcome: Outcome, now: number) {
  if (resource.language !== study.language || !reviewResources(study).some(item => item.id === resource.id)) return study;
  const next = assess(study, resource.id, outcome, now, 'spoken');
  if (outcome !== 'retry') return next;
  const result = next.results[resource.id];
  const schedules = { ...result.schedules, spoken: { ...result.schedules!.spoken!, due: now + materialRetryDelay } };
  return { ...next, results: { ...next.results, [resource.id]: { ...result, schedules, due: Math.min(...Object.values(schedules).map(item => item.due)) } } };
}
export function materialReviewStatus(result: PracticeResult | undefined, now: number) {
  const due = materialReviewDue(result);
  const outcome = result?.spokenResult ?? ((!result?.mode || result.mode === 'spoken') ? result?.result : undefined);
  return { due, label: due !== undefined && due <= now ? 'Пора повторить' : outcome === 'independent' ? 'Самостоятельно' : outcome === 'assisted' ? 'С подсказкой' : outcome === 'retry' ? 'Изучаю' : 'Новое' };
}
export function assessPracticeItem(study: Study, item: import('./model').PracticeItem, outcome: Outcome, now: number, mode: import('./model').PracticeMode) {
  return 'kind' in item && mode === 'spoken' ? assessMaterial(study,item,outcome,now) : assess(study,item.id,outcome,now,mode);
}
export function materialRecallContent(resource: Resource) {
  return { passage: resource.kind === 'exercise' ? resource.text : '',
    reference: resource.kind === 'exercise' ? resource.answer : resource.text, url: resource.url };
}
