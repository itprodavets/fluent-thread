import type { Resource, Study } from './model';
import type { LearningGraph } from './learning-graph';
import type { ProgressStatus } from './unified-progress';
import { progressAssessment } from './unified-progress.ts';
import { materialReviewDue } from './material-review.ts';

export type MapMaterialProgress = { resource: Resource; status: ProgressStatus; due: boolean; dueAt?: number };
export type MapNodeProgress = {
  total: number; independent: number; learning: number; new: number; due: number;
  items: MapMaterialProgress[];
};
export const mapMaterialStatusLabels: Record<ProgressStatus, string> = { new: 'Новое', learning: 'Изучаю', independent: 'Самостоятельно' };

export function mapProgressLabel(progress: MapNodeProgress) {
  if (!progress.total) return 'Нет материалов';
  const label = progress.independent ? `Самостоятельно ${progress.independent}/${progress.total}`
    : progress.learning ? `Изучаю ${progress.learning}/${progress.total}` : `Новое · ${progress.total}`;
  return label + (progress.due ? ` · Пора повторить ${progress.due}` : '');
}

/** A read-only projection of ONE current profile. Never cache across stores or languages. */
export function learningMapProgress(study: Study, graph: LearningGraph, now: number): Map<string, MapNodeProgress> {
  const topics = new Set(study.topics.filter(t => t.language === study.language).map(t => t.id));
  const resources = new Map<string, MapMaterialProgress>();
  const byTopic = new Map<string, MapMaterialProgress[]>();
  for (const resource of study.resources) {
    if (resource.language !== study.language || !resource.topicId || !topics.has(resource.topicId)) continue;
    const result = study.results[resource.id], at = materialReviewDue(result);
    const dueAt = at !== undefined && Number.isFinite(at) ? at : undefined;
    resources.set(resource.id, { resource, status: progressAssessment(result).status, dueAt, due: dueAt !== undefined && dueAt <= now });
  }
  for (const item of resources.values()) {
    const items = byTopic.get(item.resource.topicId!) ?? [];
    items.push(item); byTopic.set(item.resource.topicId!, items);
  }
  const summaries = new Map<string, MapNodeProgress>();
  for (const node of graph.nodes) {
    if (node.language !== study.language || !node.topicId || !topics.has(node.topicId)) continue;
    if (node.type !== 'lesson' && node.type !== 'dialogue') continue;
    const ids = new Set(node.versions?.map(v => v.id));
    const items = node.type === 'lesson' ? byTopic.get(node.topicId) ?? [] : [...ids].flatMap(id => {
      const item = resources.get(id);
      return item && item.resource.topicId === node.topicId && item.resource.kind === 'dialogue' ? [item] : [];
    });
    const summary: MapNodeProgress = { total: items.length, independent: 0, learning: 0, new: 0, due: 0, items };
    for (const item of items) { summary[item.status]++; if (item.due) summary.due++; }
    summaries.set(node.id, summary);
  }
  return summaries;
}
