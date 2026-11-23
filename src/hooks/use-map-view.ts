import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfileStore } from '../profiles';
import { mapAnchorLeaves, mapViewKey, readMapView, writeMapView } from '../domain/map-view';
import type { MapView } from '../domain/map-view';

const storage = () => { try { return window.localStorage; } catch { return undefined; } };

/** UI preferences only; never write through ProfileStore or cloud sync. */
export function useMapView(language: string) {
  const owner = useProfileStore().owner;
  const key = mapViewKey(owner, language);
  const [view, setView] = useState(() => readMapView(storage(), key));
  const latest = useRef(view);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(() => { clearTimeout(timer.current); writeMapView(storage(), key, latest.current); }, [key]);
  const change = useCallback((patch: Partial<MapView>) => {
    if (Object.entries(patch).every(([name, value]) => latest.current[name as keyof MapView] === value)) return;
    latest.current = { ...latest.current, ...patch }; setView(latest.current); flush();
  }, [flush]);
  const remember = useCallback((patch: Partial<MapView>) => {
    latest.current = { ...latest.current, ...patch };
    clearTimeout(timer.current); timer.current = setTimeout(flush, 120);
  }, [flush]);
  useEffect(() => {
    const saved = latest.current;
    let restoring = true;
    let leaving = false;
    let first = 0, second = 0;
    const record = () => { if (!restoring && !leaving) remember({ scrollX: window.scrollX, scrollY: window.scrollY }); };
    const cancel = () => { cancelAnimationFrame(first); cancelAnimationFrame(second); restoring = false; };
    // Capture before a link or practice button replaces the map's DOM.
    const capture = (event: Event) => {
      if (restoring || leaving) return;
      record(); flush();
      const target = event.target instanceof Element ? event.target : undefined;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      // Suspense may keep the old map mounted while the next screen loads.
      // Freeze before App's route effect scrolls that outgoing DOM to the top.
      if (event.type === 'pagehide' || (anchor && mapAnchorLeaves(event as MouseEvent, { hash: anchor.hash, target: anchor.target, download: anchor.hasAttribute('download') })) || target?.closest('[data-map-navigation]')) leaving = true;
    };
    const routeChanged = () => { if (location.hash !== '#map') { leaving = true; flush(); } };
    first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      window.scrollTo(saved.scrollX, saved.scrollY); restoring = false;
    }); });
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', cancel);
    document.addEventListener('click', capture, true);
    window.addEventListener('pagehide', capture);
    window.addEventListener('hashchange', routeChanged);
    return () => {
      cancel(); flush(); window.removeEventListener('scroll', record); window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel); window.removeEventListener('keydown', cancel);
      document.removeEventListener('click', capture, true); window.removeEventListener('pagehide', capture);
      window.removeEventListener('hashchange', routeChanged);
    };
  }, [flush, remember]);
  return { view, change, remember };
}
