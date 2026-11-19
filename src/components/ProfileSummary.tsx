import { useSyncExternalStore } from 'react';
import { useIdentity, useProfileStore } from '../profiles';
export const statusLabels = { local: 'На этом устройстве', pending: 'Ожидает синхронизации', syncing: 'Синхронизируем…', synced: 'Синхронизировано', error: 'Сохранено на устройстве · облако недоступно' };
export function ProfileSummary() {
  const store = useProfileStore();
  const status = useSyncExternalStore(store.subscribe, store.getStatus);
  const { user } = useIdentity();
  return <a href="#profile"><span className="status-dot" />{user ? 'Мой профиль' : 'Без входа'}<p>{statusLabels[status.state]}</p></a>;
}
