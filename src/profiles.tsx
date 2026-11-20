import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloud, cloudSelection, cloudTransport, defaultCloudConfig } from './domain/cloud';
import { loadProfile, transactProfile, setLocalOwner } from './domain/profile-storage';
import { ProfileStore } from './domain/profile-store';
import type { StoredProfile } from './domain/profile-store';
import { profileOwner } from './domain/cloud-config';
import { storagePolicyResult, isLegacyPersonalProject } from './domain/storage-policy';
import type { StorageMode } from './domain/storage-policy';
import { prepareStudy } from './domain/study-storage';
import { stopVoice } from './domain/voice.js';
const AuthContext = createContext<{ user: User | null; loading: boolean; error: string; storageMode: StorageMode; recovering: boolean; finishRecovery: () => void }>({ user: null, loading: Boolean(cloud), error: '', storageMode: 'local', recovering: false, finishRecovery: () => {} });
const StoreContext = createContext<ProfileStore | null>(null);
export function useIdentity() { return useContext(AuthContext); }
export function useProfileStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Profile unavailable');
  return store;
}
export function Profiles({ children }: { children: (store: ProfileStore) => ReactNode }) {
  const [auth, setAuth] = useState<{ user: User | null; loading: boolean; error: string }>({user:null,loading:Boolean(cloud),error:''});
  const [recovering, setRecovering] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const userId = auth.user?.id;
  const owner = userId && cloudSelection.config ? profileOwner(cloudSelection.config, userId) : 'guest';
  const [ready, setReady] = useState<ProfileStore>();
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    const subscription = cloud.auth.onAuthStateChange((event, session) => {
      if (live && event === 'PASSWORD_RECOVERY') { setRecovering(true); queueMicrotask(() => { if (live) location.hash = '#profile'; }); }
      if (live && event === 'SIGNED_OUT') setRecovering(false);
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
    setError(''); setStorageWarning('');
    setStorageMode(userId ? 'checking' : 'local');
    let checking = false;
    let channel: BroadcastChannel | undefined;
    setReady(undefined);
    const open = async () => {
      const document = await loadProfile(owner);
      if (!live) return;
      setLocalOwner(owner);
      try { channel = new BroadcastChannel('fluent-thread-profile:' + owner); } catch { /* Focus/online refresh also works without BroadcastChannel. */ }
      const persistence = {
        transact: (previous: StoredProfile, change: (doc: StoredProfile) => StoredProfile) => {
          const save = () => transactProfile(owner, previous, change, () => { if (live) channel?.postMessage('changed'); }).then(next => { if (live) setStorageWarning(''); return next; });
          // Keep compatibility with an old tab until it is refreshed. New tabs hold this
          // lock only during the local transaction, never while waiting on the network.
          return navigator.locks ? navigator.locks.request('nit-rechi-profile:' + owner,
            { signal: AbortSignal.timeout(10_000) }, save).catch(error => {
              if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('Сохранение ждёт старую вкладку. Обнови другие вкладки Fluent Thread и повтори сохранение.');
              throw error;
            }) : save();
        }
      };
      store = new ProfileStore(owner, document, persistence);
      if (channel) channel.onmessage = () => {
        if (live) void store?.refresh().then(() => store?.sync()).catch(() => {
          if (live) setError('Не удалось обновить профиль из другой вкладки. Перезагрузи эту страницу.');
        });
      };
      setReady(store);
      void store.update(prepareStudy).catch(error => { if (live) setStorageWarning(error instanceof Error ? error.message : 'Не удалось сохранить профиль.'); });
      void checkPolicy();
    };
    const checkPolicy = async () => {
      if (!cloud || !userId || !store || !live || checking) return;
      checking = true;
      try {
        const { data, error } = await cloud.rpc('study_storage_mode').abortSignal(AbortSignal.timeout(15_000));
        const legacyPersonal = isLegacyPersonalProject(cloudSelection.kind, cloudSelection.config?.url, defaultCloudConfig?.url);
        const mode = storagePolicyResult(data, error, legacyPersonal);
        if (!live) return;
        setStorageMode(mode);
        store.setTransport(mode === 'cloud' ? cloudTransport(cloud, userId) : undefined);
        if (mode === 'cloud') void store.sync();
      } catch {
        if (live) { setStorageMode('error'); store.setTransport(undefined); }
      } finally { checking = false; }
    };
    void open().catch(() => { if (live) setError('Не удалось открыть профиль. Проверь доступное место и перезагрузи страницу.'); });
    const sync = () => {
      if (!live) return;
      void store?.refresh().then(checkPolicy).catch(() => { if (live) setError('Не удалось обновить локальный профиль. Перезагрузи страницу.'); });
    };
    const saveWhenHidden = () => { if (document.visibilityState === 'hidden') void store?.saveBeforeClosing(); };
    const timer = setInterval(sync, 20_000);
    window.addEventListener('online', sync); window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      live = false; clearInterval(timer); channel?.close();
      window.removeEventListener('online', sync); window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      stopVoice(); void store?.close();
    };
  }, [owner, auth.loading, userId]);
  return <AuthContext.Provider value={{ ...auth, storageMode, recovering, finishRecovery: () => setRecovering(false) }}>
    {error ? <main role="alert">{error}</main> : auth.loading || !ready || ready.owner !== owner ? <main role="status">Открываем профиль…</main>
      : <><p role="alert" hidden={!storageWarning}>{storageWarning}</p><StoreContext.Provider value={ready}>{children(ready)}</StoreContext.Provider></>}
  </AuthContext.Provider>;
}
