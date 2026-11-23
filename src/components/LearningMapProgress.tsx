import { useState } from 'react';
import { useWorkspace } from '../context';
import type { MapMaterialProgress, MapNodeProgress } from '../domain/learning-map-progress';
import { mapMaterialStatusLabels, mapProgressLabel } from '../domain/learning-map-progress';
import type { LearningGraph, LearningNode } from '../domain/learning-graph';
import { materialMapHref } from '../domain/material-route';

export function MapProgressBadge({ progress }: { progress?: MapNodeProgress }) {
  return progress && <small className={'map-progress-badge' + (progress.due ? ' map-progress-due' : progress.independent ? ' map-progress-known' : '')}>{mapProgressLabel(progress)}</small>;
}

export function MapVersionLink({ topicId, version, item, skillId }: {
  topicId: string; version: { id: string; level?: string }; item?: MapMaterialProgress; skillId?: string;
}) {
  return <a className="map-version-link" href={materialMapHref(topicId, version.id, skillId)}>
    <strong>{version.level ?? 'Без уровня'}</strong>
    <small>{mapMaterialStatusLabels[item?.status ?? 'new']}{item?.due ? ' · Пора повторить' : ''}</small>
  </a>;
}

export function MapNodeProgressDetails({ node, graph, progress }: { node: LearningNode; graph: LearningGraph; progress?: MapNodeProgress }) {
  const { practice } = useWorkspace();
  const [limit, setLimit] = useState(12);
  if (!progress) return null;
  const due = progress.items.filter(item => item.due).sort((a, b) => a.dueAt! - b.dueAt! || a.resource.id.localeCompare(b.resource.id));
  return <section className="map-progress-detail" aria-label="Прогресс выбранного узла">
    <p><strong>{mapProgressLabel(progress)}</strong></p>
    {!!progress.total && <>
      <p className="sub">Новое: {progress.new} · Изучаю: {progress.learning} · Самостоятельно: {progress.independent}. Уровни считаются отдельно; открытие материала не означает, что он изучен.</p>
      {due.length > 0 && <><h3>Пора повторить</h3><ul className="map-due-list">{due.slice(0, limit).map(item => {
        const scene = graph.nodes.find(n => n.type === 'dialogue' && n.topicId === item.resource.topicId && n.versions?.some(v => v.id === item.resource.id));
        return <li key={item.resource.id}>{scene
          ? <a href={materialMapHref(scene.topicId!, item.resource.id)}>Повторить · {item.resource.title}</a>
          : <button type="button" data-map-navigation onClick={() => practice(item.resource.id)}>Повторить · {item.resource.title}</button>}</li>;
      })}</ul>{due.length > limit && <button type="button" onClick={() => setLimit(value => value + 12)}>Ещё повторения · {due.length - limit}</button>}</>}
      {due.length === 0 && <p className="sub">Сейчас нет материалов к повторению.</p>}
    </>}
    {progress.total === 0 && node.type === 'lesson' && <p className="sub">Можно практиковать тему; материалов с отдельными оценками пока нет.</p>}
  </section>;
}
