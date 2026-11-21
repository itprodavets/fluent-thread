import { useIdentity, useProfileStore } from '../profiles';
import { downloadProfileBackup } from './ProfileBackup';

export function LocalStorageNotice() {
  const { user, storageMode } = useIdentity();
  const store = useProfileStore();
  if (storageMode !== 'local') return null;
  return <aside className="local-storage-notice" aria-label="Локальное сохранение">
    <div><strong>Данные хранятся только в этом браузере.</strong>
      <p>Слова и прогресс могут потеряться при очистке данных браузера. На другом устройстве автоматически не появятся.</p>
    </div>
    <div className="actions">
      <button type="button" onClick={() => downloadProfileBackup(store.getDocument())}>Скачать резервную копию</button>
      <a className="button" href="#profile">{user ? 'Настроить синхронизацию' : 'Войти и перенести прогресс'}</a>
    </div>
    <details><summary>Как сохранить в профиле</summary>
      <p>{user ? 'Ты уже вошёл, но этот профиль использует локальное хранение.' : 'После входа открой профиль и нажми «Добавить данные без входа в этот профиль». Перенос выполняется отдельно; исходные гостевые данные сохранятся.'} Для синхронизации нужна подключённая своя база или доступ к облаку приложения. Сам вход не включает облачное хранение.</p>
      <p>Копия содержит слова, материалы, ответы и сроки повторения текущего профиля. Записи голоса и подробная история Anki в этот файл не входят.</p>
    </details>
  </aside>;
}
