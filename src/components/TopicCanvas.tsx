import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useWorkspace } from '../context';
import type { MapPoint, Study, Topic } from '../domain/model';
import { normalize } from '../domain/model';
import { connectTopics, disconnectTopics, moveTopic, topicEdges, topicPositions, withinCanvas } from '../domain/topic-graph';
import { Fold } from './common';
import './topic-map.css';

const directions: Record<string, MapPoint> = {
  ArrowLeft: { x: -3, y: 0 }, ArrowRight: { x: 3, y: 0 },
  ArrowUp: { x: 0, y: -3 }, ArrowDown: { x: 0, y: 3 }
};
type Gesture = { id: string; pointerId: number; kind: 'move' | 'connect'; origin: MapPoint; point: MapPoint; clientX: number; clientY: number; moved: boolean };

export function TopicCanvas({ topics, selected, onCreate }: { topics: Topic[]; selected?: string; onCreate: (point?: MapPoint) => void }) {
  const { update, openTopic } = useWorkspace();
  const [connecting, setConnecting] = useState(false);
  const [start, setStart] = useState<string>();
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(100);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ id: string; point: MapPoint }>();
  const [wire, setWire] = useState<{ id: string; point: MapPoint }>();
  const canvas = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Gesture | undefined>(undefined);
  const suppressClick = useRef(false);
  const previousSearch = useRef('');
  const unfilteredScroll = useRef({ left: 0, top: 0 });
  const rows = Math.max(3, Math.ceil(topics.length / 2));
  const positions = topicPositions(topics);
  if (preview) positions.set(preview.id, preview.point);
  const labels = new Map(topics.map(topic => [topic.id, topic.title]));
  const edges = topicEdges(topics);
  const search = normalize(query, topics[0]?.language ?? 'en');
  const visible = topics.filter(topic => !search || normalize(topic.title + ' ' + topic.prompt, topic.language).includes(search));
  const visibleIds = new Set(visible.map(topic => topic.id));
  const visibleEdges = edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));

  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    if (search) {
      if (!previousSearch.current) unfilteredScroll.current = { left: view.scrollLeft, top: view.scrollTop };
      // Search changes presentation only. Centre the first rendered match at its
      // existing coordinates, including when it sits far below the initial view.
      const match = canvas.current?.querySelector<HTMLElement>('[data-topic-id]');
      if (match) view.scrollTo({
        left: Math.max(0, match.offsetLeft - view.clientWidth / 2),
        top: Math.max(0, match.offsetTop - view.clientHeight / 2)
      });
    } else if (previousSearch.current) {
      view.scrollTo(unfilteredScroll.current);
    }
    previousSearch.current = search;
    // Deliberately react only to a new search, not dragging, saving or zooming.
  }, [search]);

  async function save(change: (study: Study) => Study) {
    try {
      const saved = await update(change);
      setMessage(saved ? 'Карта сохранена.' : 'Не удалось сохранить карту. Изменение не сохранено — повтори действие.');
      return saved;
    } catch {
      setMessage('Не удалось сохранить карту. Изменение не сохранено — повтори действие.');
      return false;
    }
  }

  async function connect(from: string, to: string) {
    if (from === to) { setMessage('Выбери другую тему для связи.'); return; }
    if (edges.some(edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))) {
      setMessage('Между этими темами уже есть связь.'); setStart(undefined); return;
    }
    if (await save(current => connectTopics(current, from, to))) setStart(undefined);
  }

  function select(id: string) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!connecting) { openTopic(id); return; }
    if (!start || start === id) { setStart(start === id ? undefined : id); return; }
    void connect(start, id);
  }

  function positionAt(event: { clientX: number; clientY: number }): MapPoint {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 100 / rect.width, y: (event.clientY - rect.top) * 100 / rect.height };
  }

  function begin(event: PointerEvent<HTMLButtonElement>, id: string, kind: Gesture['kind']) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, pointerId: event.pointerId, kind, origin: positionAt(event), point: positions.get(id)!,
      clientX: event.clientX, clientY: event.clientY, moved: false };
    if (kind === 'connect') { setStart(id); setWire({ id, point: positions.get(id)! }); }
  }

  function track(event: PointerEvent) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4;
    const at = positionAt(event);
    if (gesture.kind === 'connect') setWire({ id: gesture.id, point: at });
    else if (gesture.moved) setPreview({ id: gesture.id, point: withinCanvas({
      x: gesture.point.x + at.x - gesture.origin.x, y: gesture.point.y + at.y - gesture.origin.y
    }) });
  }

  function finish(event: PointerEvent) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    // Read the final pointer directly: React preview state may still describe the previous frame.
    const at = positionAt(event);
    gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4;
    if (gesture.moved && gesture.kind === 'move') void save(current => moveTopic(current, gesture.id, {
      x: gesture.point.x + at.x - gesture.origin.x, y: gesture.point.y + at.y - gesture.origin.y
    }));
    if (gesture.kind === 'connect' && gesture.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-topic-id]')?.dataset.topicId;
      if (target && target !== gesture.id) void connect(gesture.id, target);
      else setMessage('Связь не создана. Перетащи к другой теме или выбери её в режиме «Связать».');
    }
    suppressClick.current = gesture.moved;
    drag.current = undefined; setPreview(undefined); setWire(undefined);
  }

  function cancel() { drag.current = undefined; setPreview(undefined); setWire(undefined); }

  return <section className="topic-graph interactive-map" aria-label="Редактор карты тем">
    <div className="graph-toolbar">
      <div className="actions">
        <button className="primary" type="button" onClick={() => onCreate()}>Новая тема</button>
        <button type="button" aria-pressed={connecting} onClick={() => { setConnecting(!connecting); setStart(undefined); }}>Связать</button>
      </div>
      <div className="actions graph-zoom" role="group" aria-label="Масштаб карты">
        <button type="button" aria-label="Уменьшить карту" disabled={zoom <= 100} onClick={() => setZoom(zoom - 25)}>−</button>
        <span>{zoom}%</span>
        <button type="button" aria-label="Увеличить карту" disabled={zoom >= 200} onClick={() => setZoom(zoom + 25)}>+</button>
        <button type="button" onClick={() => { setZoom(100); viewport.current?.scrollTo(0, 0); }}>Сбросить вид</button>
      </div>
    </div>
    <label className="map-search">Найти тему <input type="search" value={query} onChange={event => { setQuery(event.target.value); setStart(undefined); setMessage(''); }} placeholder="Название или ситуация" /></label>
    <p className="sub graph-guide">{connecting ? start ? `Начало: ${labels.get(start)}. Выбери вторую тему.` : 'Выбери две темы по очереди, чтобы связать их.'
      : 'Перетаскивай темы. Для связи тяни за + к другой теме. Стрелки двигают тему с клавиатуры; двойной щелчок по фону создаёт новую.'}</p>
    <p className="map-save-status" role="status">{message || `Темы: ${visible.length} из ${topics.length}`}</p>
    {visible.length === 0 && <p>{topics.length ? 'Темы не найдены. Измени поиск.' : 'Добавь первую тему или выбери пример ниже.'}</p>}
    <div className="graph-viewport" ref={viewport}>
      <div className="network graph-canvas" ref={canvas} style={{ width: zoom + '%', height: rows * 112 * zoom / 100 }}
        onDoubleClick={event => { if (event.target === event.currentTarget) onCreate(withinCanvas(positionAt(event))); }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visibleEdges.map(({ from, to }) => {
            const a = positions.get(from)!, b = positions.get(to)!, bend = (a.x + b.x) / 2;
            return <path key={JSON.stringify([from, to])} className={selected === from || selected === to ? 'active' : ''}
              d={`M${a.x} ${a.y} C${bend} ${a.y} ${bend} ${b.y} ${b.x} ${b.y}`} />;
          })}
          {wire && <path className="map-wire" d={`M${positions.get(wire.id)!.x} ${positions.get(wire.id)!.y} L${wire.point.x} ${wire.point.y}`} />}
        </svg>
        {visible.map(topic => {
          const point = positions.get(topic.id)!;
          return <div key={topic.id} className="map-topic" data-topic-id={topic.id} style={{ left: point.x + '%', top: point.y + '%' }}>
            <button type="button" className={`graph-node ${connecting ? '' : 'graph-movable'}`} lang={topic.language}
              aria-pressed={connecting ? topic.id === start : topic.id === selected} title={topic.title}
              onClick={() => select(topic.id)}
              onKeyDown={event => {
                const direction = directions[event.key];
                if (connecting || !direction) return;
                event.preventDefault();
                void save(current => {
                  const currentPoint = topicPositions(current.topics.filter(entry => entry.language === topic.language)).get(topic.id) ?? point;
                  return moveTopic(current, topic.id, { x: currentPoint.x + direction.x, y: currentPoint.y + direction.y });
                });
              }}
              onPointerDown={event => { if (!connecting) begin(event, topic.id, 'move'); }}
              onPointerMove={track} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
              <span>{topic.title}</span>
            </button>
            <button type="button" className="map-handle" aria-label={`Связать тему: ${topic.title}`} title="Тяни к другой теме или нажми и выбери её"
              onPointerDown={event => begin(event, topic.id, 'connect')} onPointerMove={track} onPointerUp={finish}
              onPointerCancel={cancel} onLostPointerCapture={cancel}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setConnecting(true); setStart(topic.id); }}>+</button>
          </div>;
        })}
      </div>
    </div>
    {edges.length > 0 && <Fold title={`Связи между темами · ${edges.length}`}>
      <ul className="graph-edges">{edges.map(({ from, to }) => <li key={JSON.stringify([from, to])}>
        <span>{labels.get(from)} ↔ {labels.get(to)}</span>
        <button type="button" aria-label={`Убрать связь: ${labels.get(from)} и ${labels.get(to)}`}
          onClick={() => void save(current => disconnectTopics(current, from, to))}>Убрать</button>
      </li>)}</ul>
    </Fold>}
  </section>;
}
