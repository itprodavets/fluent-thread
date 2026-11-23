import { useWorkspace } from '../context';
import type { LearningGraph, LearningNode } from '../domain/learning-graph';
import type { MapNodeProgress } from '../domain/learning-map-progress';
import { mapFilterLabels, mapPracticeTarget, mapResultsPage } from '../domain/learning-map-filter';
import type { MapProgressFilter } from '../domain/learning-map-filter';
import { learningNodeLabels } from './learning-map-view';
import { MapProgressBadge } from './LearningMapProgress';

export function LearningMapResults({ nodes, graph, progress, filter, page, setPage, selected, onSelect }: {
  nodes: LearningNode[]; graph: LearningGraph; progress: Map<string, MapNodeProgress>; filter: MapProgressFilter;
  page: number; setPage: (page: number) => void; selected?: string; onSelect: (id: string) => void;
}) {
  const { practice } = useWorkspace();
  const shown = mapResultsPage(nodes, page);
  return <>
    <p className="sub" role="status">Найдено: {nodes.length}</p>
    <ul className="learning-results map-result-cards">{shown.items.map(node => {
      const target = mapPracticeTarget(node, progress.get(node.id), filter, graph);
      const action = target && <>Практика{target.level ? ' · ' + target.level : ''}</>;
      return <li key={node.id}>
        <button type="button" className="map-result-select" aria-pressed={node.id === selected} onClick={() => onSelect(node.id)}><small>{learningNodeLabels[node.type]}</small><strong>{node.title}</strong>{node.school && <small>{node.school}</small>}<MapProgressBadge progress={progress.get(node.id)} />{filter !== 'all' && <small>{mapFilterLabels[filter]}: {progress.get(node.id)?.[filter] ?? 0}</small>}</button>
        {target && (target.href ? <a className="map-filter-practice" href={target.href} aria-label={'Практиковать: ' + target.item.resource.title}>{action}</a>
          : <button type="button" className="map-filter-practice" aria-label={'Практиковать: ' + target.item.resource.title} onClick={() => practice(target.item.resource.id)}>{action}</button>)}
      </li>;
    })}</ul>
    {!nodes.length && <p>Подходящих уроков и диалогов сейчас нет. Выбери другой статус или измени поиск.</p>}
    {shown.pages > 1 && <div className="actions map-result-pages"><button type="button" disabled={shown.page === 0} onClick={() => setPage(shown.page - 1)}>Назад</button><span>{shown.page + 1} / {shown.pages}</span><button type="button" disabled={shown.page + 1 >= shown.pages} onClick={() => setPage(shown.page + 1)}>Дальше</button></div>}
  </>;
}
