import type { MapProgressFilter } from './learning-map-filter';

export type MapView = {
  version: 1; query: string; kind: string; status: MapProgressFilter; browsePage: number;
  focusId?: string; focusPage: number; zoom: number; overviewOpen: boolean;
  scrollX: number; scrollY: number; canvasX: number; canvasY: number;
};
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const memory = new Map<string, MapView>();
export function mapAnchorLeaves(click: { button?: number; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }, anchor: { hash: string; target: string; download?: boolean }) {
  return !!anchor.hash && anchor.hash !== '#map' && !anchor.download && ['', '_self', '_top', '_parent'].includes(anchor.target.toLowerCase())
    && (click.button === undefined || click.button === 0) && !click.metaKey && !click.ctrlKey && !click.shiftKey && !click.altKey;
}
export const mapViewKey = (owner: string, language: string) => JSON.stringify(['fluent-thread:map-view', owner, language]);
const number = (value: unknown, fallback = 0, max = 1_000_000) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
export function validMapView(value?: unknown): MapView {
  const v = value && typeof value === 'object' && (value as MapView).version === 1 ? value as Partial<MapView> : {};
  const status = ['all','due','learning','new'].includes(v.status ?? '') ? v.status! : 'all';
  let kind = ['all','lesson','dialogue','school','skill'].includes(v.kind ?? '') ? v.kind! : 'all';
  if (status !== 'all' && ['school','skill'].includes(kind)) kind = 'all';
  return { version: 1, query: typeof v.query === 'string' ? v.query.slice(0, 512) : '', kind, status,
    browsePage: Math.floor(number(v.browsePage, 0, 100_000)), focusPage: Math.floor(number(v.focusPage, 0, 100_000)),
    focusId: typeof v.focusId === 'string' && v.focusId.length <= 2048 ? v.focusId : undefined,
    zoom: [100,125,150,175,200].includes(v.zoom ?? 0) ? v.zoom! : 100, overviewOpen: v.overviewOpen === true,
    scrollX: number(v.scrollX), scrollY: number(v.scrollY), canvasX: number(v.canvasX), canvasY: number(v.canvasY) };
}
export function readMapView(storage: StoragePort | undefined, key: string): MapView {
  try { const raw = storage?.getItem(key); if (raw) { const view = validMapView(JSON.parse(raw)); memory.set(key, view); return view; } } catch { /* Last in-memory view remains available. */ }
  return memory.get(key) ?? validMapView();
}
export function writeMapView(storage: StoragePort | undefined, key: string, value: MapView) {
  const view = validMapView(value); memory.set(key, view);
  try { storage?.setItem(key, JSON.stringify(view)); } catch { /* Navigation still works when browser storage is unavailable. */ }
}
