import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell';
import { StudyContext } from './context';
import { itemsForLanguage, pages } from './domain/model';
import { Profiles } from './profiles';
import type { ProfileStore } from './domain/profile-store';
import type { Page, Study } from './domain/model';
import { stopVoice } from './domain/voice.js';
import './styles.css';
import './shell.css';
import './learning.css';
import './dialogue.css';
import './story.css';
import './interface.css';

const Today = lazy(() => import('./components/Today').then(module => ({ default: module.Today })));
const Practice = lazy(() => import('./components/Practice').then(module => ({ default: module.Practice })));
const Progress = lazy(() => import('./components/Progress').then(module => ({ default: module.Progress })));
const MapPage = lazy(() => import('./components/Map').then(module => ({ default: module.MapPage })));
const Materials = lazy(() => import('./components/Materials').then(module => ({ default: module.Materials })));
const Schools = lazy(() => import('./components/SchoolDirectory').then(module => ({ default: module.SchoolDirectory })));
const Resources = lazy(() => import('./components/Resources').then(module => ({ default: module.Resources })));
const Profile = lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const Account = lazy(() => import('./components/Account').then(module => ({ default: module.Account })));

const screens = { today: Today, practice: Practice, map: MapPage, materials: Materials, schools: Schools, resources: Resources, progress: Progress, account: Account, profile: Profile };
function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
function route(hash: string): Page {
  if (hash === '#materials/schools') return 'schools';
  const value = hash.slice(1).split('/')[0];
  return Object.hasOwn(pages, value) ? value as Page : 'today';
}
function go(page: Page) {
  if (location.hash !== '#' + page) location.hash = page;
}

function App({ store }: { store: ProfileStore }) {
  const study = useSyncExternalStore(store.subscribe, store.getStudy);
  const [notice, notify] = useState('');
  const [practiceId, setPractice] = useState<string>();
  const [topicId, setTopic] = useState<string>();
  const [resourceId, setResource] = useState<string>();
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  const page = route(hash);
  const active = useMemo(() => itemsForLanguage(study), [study]);
  const Screen = screens[page];
  useEffect(() => {
    stopVoice();
    window.scrollTo(0, 0);
  }, [hash]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => notify(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    window.addEventListener('pagehide', stopVoice);
    return () => window.removeEventListener('pagehide', stopVoice);
  }, []);

  const update = useCallback((change: (current: Study) => Study) => {
    return store.update(change).catch(error => {
      notify(error instanceof Error ? error.message : 'Не удалось сохранить изменения. Проверь доступное место в браузере.');
      return false;
    });
  }, [store]);
  const practice = (id: string) => { setPractice(id); if (page === 'map' || hash === '#practice/map') location.hash = 'practice/map'; else go('practice'); };
  const openTopic = (id: string) => { setTopic(id); go('map'); };
  const openResource = (id: string) => { setResource(id); if (page === 'map') location.hash = 'materials/map'; else go('materials'); };

  return <StudyContext.Provider value={{ study, active, notify, update, go, practice, openTopic, openResource, practiceId, topicId, resourceId }}>
    <AppShell page={page}><Suspense fallback={<p className="sub" role="status">Загружаем…</p>}><Screen key={study.language + ':' + hash} /></Suspense></AppShell>
    <p className="notice" id="notice" role="status" hidden={!notice}>{notice}</p>
  </StudyContext.Provider>;
}

const root = createRoot(document.querySelector('#root')!);
root.render(<main role="status">Открываем локальный словарь…</main>);
// The retired database contains only copies of lesson recordings. Learner takes use a separate store.
try { indexedDB.deleteDatabase('nit-rechi-lesson-audio'); } catch { /* Storage may be disabled. */ }
root.render(<Profiles>{store => <App key={store.owner} store={store} />}</Profiles>);
