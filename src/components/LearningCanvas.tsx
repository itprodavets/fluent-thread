import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useWorkspace } from '../context';
import type { MapPoint, Study } from '../domain/model';
import { normalize } from '../domain/model';
import { connectLearningNodes, disconnectLearningNodes, moveLearningNode } from '../domain/learning-graph';
import type { LearningGraph, LearningProjection } from '../domain/learning-graph';
import { learningMapFrame, learningMapPositions, learningNodeLabels } from './learning-map-view';
import { Fold } from './common';
import './learning-map.css';

type Gesture = { id: string; pointerId: number; kind: 'move' | 'connect'; origin: MapPoint; point: MapPoint; clientX: number; clientY: number; moved: boolean };
const directions: Record<string, MapPoint> = { ArrowLeft: { x: -3, y: 0 }, ArrowRight: { x: 3, y: 0 }, ArrowUp: { x: 0, y: -3 }, ArrowDown: { x: 0, y: 3 } };

export function LearningCanvas({ graph, projection, selected, onSelect, onPageChange, onCreate }: {
  graph: LearningGraph; projection: LearningProjection; onPageChange: (page: number) => void; selected?: string; onSelect: (id: string) => void; onCreate: (point?: MapPoint) => void;
}) {
  const { update, study } = useWorkspace();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [browsePage, setBrowsePage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [start, setStart] = useState<string>();
  const [connecting, setConnecting] = useState(false);
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ id: string; point: MapPoint }>();
  const [wire, setWire] = useState<MapPoint>();
  const canvas = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Gesture | undefined>(undefined);
  const suppressClick = useRef(false);
  useEffect(() => { setZoom(100); viewport.current?.scrollTo(0, 0); }, [selected]);
  const nodes = projection.nodes;
  const frame = useMemo(() => learningMapFrame(nodes.map(node => node.point)), [nodes.map(node => node.id + ':' + node.point.x + ':' + node.point.y).join('|')]);
  const canvasHeight = Math.max(450, Math.min(1800, nodes.length * 100));
  const positions = learningMapPositions(nodes, canvasHeight);
  if (preview) {
    const original = graph.nodes.find(node => node.id === preview.id)!;
    const base = positions.get(preview.id)!;
    const from = frame.present(original.point), to = frame.present(preview.point);
    positions.set(preview.id, { x: base.x + to.x - from.x, y: base.y + to.y - from.y });
  }
  const labels = new Map(graph.nodes.map(node => [node.id, node.title]));
  const search = normalize(query, study.language);
  const found = graph.nodes.filter(node => (kind === 'all' || node.type === kind) && (!search || normalize(node.title + ' ' + (node.school ?? ''), study.language).includes(search)));
  const destinationSearch = normalize(destination, study.language);
  const destinations = graph.nodes.filter(node => node.id !== start && (!destinationSearch || normalize(node.title + ' ' + (node.school ?? ''), study.language).includes(destinationSearch)));

  async function save(change: (study: Study) => Study) {
    try { const ok = await update(change); setMessage(ok ? 'Карта сохранена.' : 'Не удалось сохранить карту. Повтори действие.'); return ok; }
    catch { setMessage('Не удалось сохранить карту. Повтори действие.'); return false; }
  }
  async function connect(from: string, to: string) {
    if (from === to) { setMessage('Выбери другой узел.'); return; }
    if (graph.edges.some(edge => edge.from === from && edge.to === to || edge.to === from && edge.from === to)) {
      setMessage('Эти узлы уже связаны. Автоматическая связь не требует ручного дубликата.'); return;
    }
    if (await save(current => connectLearningNodes(current, graph, from, to))) { setStart(undefined); setConnecting(false); }
  }
  function select(id: string) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (connecting) { if (start && start !== id) void connect(start, id); else setStart(id); }
    else { onSelect(id); }
  }
  function at(event: { clientX: number; clientY: number }) {
    const rect = canvas.current!.getBoundingClientRect();
    return frame.world({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 });
  }
  function begin(event: PointerEvent<HTMLButtonElement>, id: string, kind: Gesture['kind']) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = false;
    const point = graph.nodes.find(node => node.id === id)!.point;
    drag.current = { id, pointerId: event.pointerId, kind, point, origin: at(event), clientX: event.clientX, clientY: event.clientY, moved: false };
    if (kind === 'connect') { setStart(id); setWire(point); }
  }
  function track(event: PointerEvent) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4;
    const point = at(event);
    if (gesture.kind === 'connect') setWire(point);
    else if (gesture.moved) setPreview({ id: gesture.id, point: { x: gesture.point.x + point.x - gesture.origin.x, y: gesture.point.y + point.y - gesture.origin.y } });
  }
  function cancel() { drag.current = undefined; setPreview(undefined); setWire(undefined); }
  function finish(event: PointerEvent) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4;
    const point = at(event);
    if (gesture.moved && gesture.kind === 'move') void save(current => moveLearningNode(current, graph, gesture.id, { x: gesture.point.x + point.x - gesture.origin.x, y: gesture.point.y + point.y - gesture.origin.y }));
    if (gesture.kind === 'connect' && gesture.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-learning-id]')?.dataset.learningId;
      if (target && target !== gesture.id) void connect(gesture.id, target);
      else { setConnecting(true); setMessage('Выбери назначение связи в поиске ниже.'); }
    }
    suppressClick.current = gesture.moved;
    cancel();
  }

  return <section className="learning-map" aria-label="Связанная карта обучения">
    <div className="graph-toolbar"><div className="actions">
      <button type="button" className="primary" onClick={() => onCreate()}>Новая тема</button>
      <button type="button" aria-pressed={connecting} onClick={() => { setConnecting(!connecting); setStart(undefined); }}>Связать</button>
    </div><div className="actions" role="group" aria-label="Масштаб карты">
      <button type="button" aria-label="Уменьшить карту" disabled={zoom <= 100} onClick={() => setZoom(zoom - 25)}>−</button><span>{zoom}%</span>
      <button type="button" aria-label="Увеличить карту" disabled={zoom >= 200} onClick={() => setZoom(zoom + 25)}>+</button>
      <button type="button" onClick={() => { setZoom(100); viewport.current?.scrollTo(0, 0); }}>Сбросить вид</button>
    </div></div>
    <p className="sub">Пунктир — автоматические связи из материалов; сплошные линии — твои связи. Перетаскивай узлы или двигай стрелками. Для новой связи тяни + или выбери два узла.</p>
    <div className="learning-browser"><label>Найти на всей карте <input type="search" value={query} placeholder="Название школы, урока, сцены или навыка" onChange={event => { setQuery(event.target.value); setBrowsePage(0); }} /></label>
      <label>Показать <select value={kind} onChange={event => { setKind(event.target.value); setBrowsePage(0); }}><option value="all">Все типы</option>{Object.entries(learningNodeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <Fold title={`Обзор всей карты · ${found.length}`}><ul className="learning-results">{found.slice(browsePage * 12, (browsePage + 1) * 12).map(node => <li key={node.id}><button type="button" aria-pressed={node.id === selected} onClick={() => { onSelect(node.id); }}><small>{learningNodeLabels[node.type]}</small> {node.title}{node.school && <small>{node.school}</small>}</button></li>)}</ul>
        {!found.length && <p>Ничего не найдено. Измени поиск.</p>}
        <div className="actions"><button type="button" disabled={browsePage === 0} onClick={() => setBrowsePage(browsePage - 1)}>Назад</button><span>{browsePage + 1} / {Math.max(1, Math.ceil(found.length / 12))}</span><button type="button" disabled={(browsePage + 1) * 12 >= found.length} onClick={() => setBrowsePage(browsePage + 1)}>Дальше</button></div>
      </Fold>
    </div>
    {query && <div className="learning-search-matches actions">{found.slice(0, 12).map(node => <button type="button" key={node.id} onClick={() => { onSelect(node.id); }}>{learningNodeLabels[node.type]} · {node.title}</button>)}{found.length > 12 && <small>Все {found.length} результатов доступны в обзоре выше.</small>}</div>}
    <p className="learning-status" role="status">{message || `В фокусе ${nodes.length} узлов из ${graph.nodes.length}.`}{connecting && (start ? ` Начало: ${labels.get(start)}. Выбери назначение.` : ' Выбери начало связи.')}</p>
    {projection.pages > 1 && <div className="actions"><button type="button" disabled={projection.page === 0} onClick={() => onPageChange(projection.page - 1)}>Предыдущие связи</button><span>Страница {projection.page + 1} / {projection.pages} · всего {projection.total}</span><button type="button" disabled={projection.page + 1 >= projection.pages} onClick={() => onPageChange(projection.page + 1)}>Следующие связи</button></div>}
    <div className="graph-viewport" ref={viewport}><div className="learning-canvas" ref={canvas} style={{ width: zoom + '%', height: canvasHeight * zoom / 100 }}
      onDoubleClick={event => { if (event.target === event.currentTarget) onCreate(at(event)); }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{projection.edges.map(edge => {
        const a = positions.get(edge.from), b = positions.get(edge.to); if (!a || !b) return null;
        return <path key={edge.id} className={edge.automatic ? 'automatic' : 'manual'} d={`M${a.x} ${a.y} L${b.x} ${b.y}`} />;
      })}{wire && start && positions.has(start) && <path className="manual" d={`M${positions.get(start)!.x} ${positions.get(start)!.y} L${frame.present(wire).x} ${frame.present(wire).y}`} />}</svg>
      {nodes.map(node => { const point = positions.get(node.id)!; return <div key={node.id} className={`learning-node learning-${node.type}`} data-learning-id={node.id} style={{ left: point.x + '%', top: point.y + '%' }}>
        <button type="button" lang={node.language} aria-pressed={node.id === (connecting ? start : selected)} title={node.title} onClick={() => select(node.id)}
          onPointerDown={event => { if (!connecting) begin(event, node.id, 'move'); }} onPointerMove={track} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
          onKeyDown={event => { const direction = directions[event.key]; if (!direction || connecting) return; event.preventDefault(); void save(current => moveLearningNode(current, graph, node.id, { x: node.point.x + direction.x, y: node.point.y + direction.y })); }}>
          <small>{learningNodeLabels[node.type]}</small><span>{node.title}</span>
        </button><button type="button" className="learning-handle" aria-label={`Связать: ${node.title}`} onPointerDown={event => begin(event, node.id, 'connect')} onPointerMove={track} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
          onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setConnecting(true); setStart(node.id); }}>+</button>
      </div>; })}
    </div></div>
    <div className="learning-mobile-list actions" aria-label="Узлы в фокусе">{nodes.map(node => <button type="button" key={node.id} aria-pressed={selected === node.id} onClick={() => select(node.id)}>{learningNodeLabels[node.type]} · {node.title}</button>)}</div>
    {connecting && start && <fieldset><legend>Назначение связи · вся карта</legend><label>Поиск назначения<input type="search" value={destination} onChange={event => setDestination(event.target.value)} /></label><select aria-label="Узел назначения" defaultValue="" onChange={event => { if (event.target.value) void connect(start, event.target.value); event.target.value = ''; }}><option value="">Выбери узел ({destinations.length})</option>{destinations.map(node => <option key={node.id} value={node.id}>{learningNodeLabels[node.type]} · {node.title}{node.school ? ' · ' + node.school : ''}</option>)}</select><button type="button" onClick={() => { setConnecting(false); setStart(undefined); }}>Отменить связь</button></fieldset>}
    <Fold title={`Связи в фокусе · ${projection.edges.length}`}><ul className="graph-edges">{projection.edges.map(edge => <li key={edge.id}><span>{labels.get(edge.from)} ↔ {labels.get(edge.to)}<small>{edge.automatic ? 'Автоматическая' : 'Ручная'}{edge.label ? ' · ' + edge.label : ''}{edge.automatic && edge.manual ? ' · есть ручная связь' : ''}</small></span>{edge.manual && <button type="button" onClick={() => void save(current => disconnectLearningNodes(current, graph, edge.id))}>Убрать ручную связь</button>}</li>)}</ul></Fold>
  </section>;
}
