import type { LearningGraph, LearningNode } from './learning-graph';
import type { MapMaterialProgress, MapNodeProgress } from './learning-map-progress';
import { materialMapHref } from './material-route.ts';

export type MapProgressFilter = 'all' | 'due' | 'learning' | 'new';
export const mapFilterLabels: Record<MapProgressFilter, string> = { all: 'Все', due: 'Пора повторить', learning: 'Изучаю', new: 'Новое' };
export function matchesMapProgress(progress: MapNodeProgress | undefined, filter: MapProgressFilter) {
  return filter === 'all' || !!progress && progress[filter] > 0;
}
export function mapResultsPage<T>(items: T[], page: number, size = 12) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.max(0, Math.min(pages - 1, Number.isFinite(page) ? Math.floor(page) : 0));
  return { items: items.slice(current * size, (current + 1) * size), page: current, pages };
}
/** Choose only an eligible saved resource; a scene's B2 never stands in for due C1. */
export function mapPracticeTarget(node: LearningNode, progress: MapNodeProgress | undefined, filter: MapProgressFilter, graph: LearningGraph) {
  const items = progress?.items.filter(item => filter === 'all' || (filter === 'due' ? item.due : item.status === filter)) ?? [];
  const versions = graph.nodes.filter(n => n.type === 'dialogue' && n.topicId === node.topicId).flatMap(n => n.versions ?? []);
  const b2 = new Set(versions.filter(v => v.level === 'B2').map(v => v.id));
  const item: MapMaterialProgress | undefined = filter === 'due'
    ? [...items].sort((a, b) => a.dueAt! - b.dueAt! || a.resource.id.localeCompare(b.resource.id))[0]
    : items.find(item => b2.has(item.resource.id)) ?? items.find(item => item.resource.kind === 'dialogue') ?? items[0];
  if (!item) return undefined;
  const version = versions.find(v => v.id === item.resource.id);
  return { item, level: version?.level, href: version && node.topicId ? materialMapHref(node.topicId, item.resource.id) : undefined };
}
