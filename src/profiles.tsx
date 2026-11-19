import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloud, cloudSelection, cloudTransport } from './domain/cloud';
import { loadProfile, saveProfile, setLocalOwner } from './domain/profile-storage';
import { ProfileStore } from './domain/profile-store';
import { profileOwner } from './domain/cloud-config';
import { stopVoice } from './domain/voice.js';
const AuthContext = createContext<{ user: User | null; loading: boolean; error: string }>({ user: null, loading: Boolean(cloud), error: '' });
const StoreContext = createContext<ProfileStore | null>(null);
export function useIdentity() { return useContext(AuthContext); }
export function useProfileStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Profile unavailable');
  return store;
}
export function Profiles({ children }: { children: (store: ProfileStore) => ReactNode }) {
  const [auth, setAuth] = useState<{ user: User | null; loading: boolean; error: string }>({user:null,loading:Boolean(cloud),error:''});
  const userId = auth.user?.id;
  const owner = userId && cloudSelection.config ? profileOwner(cloudSelection.config, userId) : 'guest';
  const [ready, setReady] = useState<ProfileStore>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    const subscription = cloud.auth.onAuthStateChange((_event, session) => {
      if (live) setAuth({ user: session?.user ?? null, loading: false, error: '' });
    }).data.subscription;
    cloud.auth.getSession().then(({data,error}) => {
      if (live && error) setAuth({user:null,loading:false,error:'Не удалось восстановить вход. Войди в профиль снова.'});
      else if (live) setAuth({user:data.session?.user ?? null,loading:false,error:''});
    }).catch(() => { if(live) setAuth({user:null,loading:false,error:'Не удалось восстановить вход.'}); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (auth.loading) return;
    let live = true; let store: ProfileStore | undefined;
    setError('');
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setReady(undefined);
    const open = async () => {
      const hold = new Promise<void>(resolve => { release = resolve; });
      const document = await loadProfile(owner);
      if (!live) return;
      setLocalOwner(owner);
      store = new ProfileStore(owner, document, next => saveProfile(owner, next), cloud && owner !== 'guest' ? cloudTransport(cloud, userId!) : undefined);
      setReady(store);
      void store.sync();
      await hold;
    };
    if (!navigator.locks) setError('Для безопасного сохранения профиля нужен современный браузер с Web Locks. Обнови Chrome, Safari или Firefox.');
    else void navigator.locks.request('nit-rechi-profile:' + owner, { signal: controller.signal }, open)
      .catch(error => { if (live && error.name !== 'AbortError') setError('Не удалось открыть профиль. Проверь доступное место и перезагрузи страницу.'); });
    const sync = () => { void store?.sync(); };
    const timer = setInterval(sync, 20_000);
    window.addEventListener('online', sync); window.addEventListener('focus', sync);
    return () => {
      live = false; controller.abort(); clearInterval(timer);
      window.removeEventListener('online', sync); window.removeEventListener('focus', sync);
      stopVoice(); store?.dispose();
      if (store) void store.flush().finally(() => release?.());
      else release?.();
    };
  }, [owner, auth.loading, userId]);
  return <AuthContext.Provider value={auth}>
    {error ? <main role="alert">{error}</main> : auth.loading || !ready || ready.owner !== owner ? <main role="status">Открываем профиль… Если он уже открыт в другой вкладке этого браузера, закрой её — данные загрузятся автоматически.</main>
      : <StoreContext.Provider value={ready}>{children(ready)}</StoreContext.Provider>}
  </AuthContext.Provider>;
}
