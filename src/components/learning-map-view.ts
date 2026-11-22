import type { MapPoint } from '../domain/model.ts';

export const learningNodeLabels = { school: 'Школа', lesson: 'Урок', dialogue: 'Сцена', skill: 'Навык' } as const;

// Fit only the visible world. Saving and pointer movement always use the inverse
// transform, so changing focus never rewrites the language-wide coordinates.
export function learningMapFrame(points: MapPoint[]) {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const left = xs.length ? Math.min(...xs) : 50, right = xs.length ? Math.max(...xs) : 50;
  const top = ys.length ? Math.min(...ys) : 50, bottom = ys.length ? Math.max(...ys) : 50;
  const width = Math.max(30, right - left), height = Math.max(20, bottom - top);
  return {
    present: (point: MapPoint): MapPoint => ({ x: 15 + (point.x - left) / width * 70, y: 12 + (point.y - top) / height * 76 }),
    world: (point: MapPoint): MapPoint => ({ x: left + (point.x - 15) / 70 * width, y: top + (point.y - 12) / 76 * height })
  };
}

/** Separate overlapping cards in the presentation only; points remain untouched. */
export function learningMapPositions(nodes: { id: string; point: MapPoint }[], height: number) {
  const frame = learningMapFrame(nodes.map(node => node.point));
  const positions = new Map<string, MapPoint>();
  const gapY = 112 / height * 100;
  const rows = Math.max(1, Math.floor(76 / gapY));
  const slots = Array.from({ length: rows }, (_, row) => [16, 50, 84].map(x => ({ x, y: 12 + row * (76 / Math.max(1, rows - 1)) }))).flat();
  const collides = (point: MapPoint) => [...positions.values()].some(other => Math.abs(other.x - point.x) < 28 && Math.abs(other.y - point.y) < gapY);
  for (const node of nodes) {
    const point = frame.present(node.point);
    const available = slots.filter(slot => !collides(slot)).sort((a, b) => Math.hypot((a.x - point.x) * 7.6, (a.y - point.y) * height / 100) - Math.hypot((b.x - point.x) * 7.6, (b.y - point.y) * height / 100));
    positions.set(node.id, collides(point) && available.length ? available[0] : point);
  }
  return positions;
}

// A newly selected focus (including a language switch) always starts on page 1.
export function learningFocusPage(state: { focusId?: string; page: number }, focusId?: string) {
  return state.focusId === focusId ? state.page : 0;
}
