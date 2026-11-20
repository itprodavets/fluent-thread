import { useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { cloud } from '../domain/cloud';
import { useIdentity, useProfileStore } from '../profiles';
import { loadProfile } from '../domain/profile-storage';
import { copyGuestLocalData } from '../domain/profile-local-migration';
import { packStudy, unpackStudy } from '../domain/profile-sync';
import { useWorkspace } from '../context';
import { Heading } from './common';
import { CloudSettings } from './CloudSettings';
import { statusLabels } from './ProfileSummary';
export function Profile() {
  const { user, error: authError, storageMode } = useIdentity();
  const store = useProfileStore();
  const status = useSyncExternalStore(store.subscribe, store.getStatus);
  const { study, update, notify } = useWorkspace();
  const document = useSyncExternalStore(store.subscribe, store.getDocument);
  const [email, setEmail] = useState('');
  const [name, setName] = useState(study.profileName ?? user?.user_metadata.display_name ?? '');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);
  async function requestCode(event: FormEvent) {
    event.preventDefault(); if (!cloud) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await cloud.auth.signInWithOtp({ email: email.trim(), options: {
        emailRedirectTo: location.origin + location.pathname + '#profile', data: { display_name: name.trim() }
      } });
      if (error) throw error;
      setSent(true); setMessage('Письмо отправлено. Открой ссылку из письма или введи код, если он указан в письме.');
    } catch { setMessage('Не удалось отправить письмо. Проверь адрес и попробуй позже. Возможно, в Supabase ещё не настроена отправка писем.'); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (!cloud) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await cloud.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
      if (error) throw error;
      location.hash = '#profile';
    } catch { setMessage('Код не подошёл или истёк. Проверь письмо или запроси новое.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    if (!cloud) return; setBusy(true);
    try {
      const saved = await store.saveBeforeClosing();
      if (storageMode !== 'local' && saved.state !== 'synced') { setMessage('Изменения сохранены на устройстве, но ещё не отправлены в облако. Восстанови связь и повтори выход.'); return; }
      const { error } = await cloud.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setMessage('Не удалось выйти. Попробуй ещё раз.'); }
    finally { setBusy(false); }
  }
  async function saveBeforeClosing() {
    setBusy(true); setMessage('Сохраняем изменения…');
    try {
      const saved = await store.saveBeforeClosing();
      setMessage(storageMode === 'cloud' && saved.state === 'synced'
        ? 'Всё сохранено и синхронизировано. Можно закрыть вкладку и продолжить на другом устройстве.'
        : storageMode === 'local'
          ? 'Всё сохранено на этом устройстве. Можно закрыть вкладку. Для переноса на другое устройство нужна резервная копия или своя база.'
          : 'Изменения сохранены на устройстве. Облачная синхронизация пока не завершена — дождись подключения перед переходом на другое устройство.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось закончить сохранение. Оставь вкладку открытой и повтори попытку.'); }
    finally { setBusy(false); }
  }
  async function importGuest() {
    setImporting(true);
    try {
      const guest = await loadProfile('guest');
      await copyGuestLocalData(store.owner);
      const saved = await update(current => unpackStudy({ ...packStudy(guest.study), ...packStudy(current) }));
      if (saved) notify('Словарь и результаты добавлены в профиль. Локальная история Anki и записи сохранены на этом устройстве; существующие данные профиля сохранены.');
    } catch { notify('Не удалось перенести данные. Исходный словарь сохранён без изменений.'); }
    finally { setImporting(false); }
  }
  function downloadBackup() {
    const blob = new Blob([JSON.stringify({ format: 'fluent-thread-profile', version: 1, exportedAt: new Date().toISOString(), study, conflicts: document.conflicts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a');
    anchor.href = url; anchor.download = 'fluent-thread-profile-' + new Date().toISOString().slice(0,10) + '.json';
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return <>
    <Heading title="Профиль" detail="Твой словарь, ошибки и очередь повторения — отдельно от других пользователей." />
    <div className="profile-layout">
      <section className="resource" aria-label="Вход и профиль">
        {user ? <>
          <h2>{study.profileName || user.user_metadata.display_name || 'Мой профиль'}</h2>
          <p>{user.email}</p>
          <form onSubmit={async event => { event.preventDefault(); if (await update(current => ({ ...current, profileName: name.trim() }))) notify('Имя сохранено.'); }}>
            <label>Имя в приложении<input value={name} maxLength={120} onChange={event => setName(event.target.value)} autoComplete="name" /></label>
            <div className="actions"><button type="submit">Сохранить имя</button><button type="button" disabled={busy} onClick={signOut}>Выйти на этом устройстве</button></div>
          </form>
          <p className="sub">{storageMode === 'cloud' ? 'На другом устройстве подключи ту же базу и войди с тем же email — словарь и прогресс загрузятся из облака.' : 'Вход сохраняет учётную запись. Слова и прогресс этого профиля остаются в данном браузере. Для синхронизации подключи свою базу Supabase на обоих устройствах.'}</p>
        </> : <>
          <h2>Войти или создать профиль</h2>
          <p>У каждого свой email. Пароль создавать не нужно — вход подтверждается письмом.</p>
          {!cloud ? <p className="profile-warning" role="status">Облачное сохранение пока не настроено. Сейчас можно заниматься и скачивать резервную копию; данные остаются в этом браузере.</p> : <>
            <form onSubmit={requestCode}>
              <label>Как тебя зовут<input value={name} onChange={event => setName(event.target.value)} maxLength={120} autoComplete="name" /></label>
              <label>Email<input type="email" required value={email} onChange={event => { setEmail(event.target.value); setSent(false); setToken(''); }} autoComplete="email" /></label>
              <button className="primary" disabled={busy} type="submit">{busy ? 'Подожди…' : sent ? 'Отправить письмо ещё раз' : 'Получить письмо для входа'}</button>
            </form>
            {sent && <form onSubmit={verify}>
              <label>Код из письма<input value={token} onChange={event => setToken(event.target.value)} required minLength={6} maxLength={10} inputMode="numeric" autoComplete="one-time-code" /></label>
              <button disabled={busy} type="submit">Подтвердить код</button>
            </form>}
          </>}
          {authError && <p role="alert">{authError}</p>}
        </>}
        {message && <p role="status">{message}</p>}
      </section>
      <section className="resource" aria-label="Сохранение и синхронизация">
        <h2>Сохранение</h2>
        <p role="status">{storageMode === 'checking' ? 'Проверяем режим хранения…' : storageMode === 'error' ? 'Не удалось проверить синхронизацию. Данные сохранены на устройстве; повторим проверку при восстановлении связи.' : statusLabels[status.state]}</p>
        {storageMode === 'local' && <p>Локальное хранение: слова, материалы, ошибки и очередь повторения остаются в этом браузере. На другом устройстве автоматически не появятся. Скачивай резервную копию или подключи свою базу.</p>}
        {status.lastSync && <p className="sub">Последняя синхронизация: {new Date(status.lastSync).toLocaleString('ru')}</p>}
        {status.message && <p role="status">{status.message}</p>}
        <p>{study.words.length.toLocaleString('ru')} слов и выражений · {Object.keys(study.results).length.toLocaleString('ru')} записей прогресса</p>
        <div className="actions">
          {user && storageMode === 'cloud' && <button type="button" disabled={status.state === 'syncing'} onClick={() => { void store.sync(); }}>Синхронизировать сейчас</button>}
          <button type="button" disabled={busy} onClick={() => void saveBeforeClosing()}>{busy ? 'Сохраняем…' : 'Сохранить перед закрытием'}</button>
          <button type="button" onClick={downloadBackup}>Скачать резервную копию</button>
          <a className="button" href="#account">Открыть словарь</a>
        </div>
        <p className="sub">Можно держать профиль открытым в нескольких вкладках. Изменения сохраняются после каждого действия; при переходе в другую вкладку приложение дополнительно запускает синхронизацию. Закрытие браузера без сети не гарантирует отправку в облако: оставшиеся изменения отправятся при следующем открытии.</p>
        <p className="sub">Облачная синхронизация доступна в своей базе или в подключённом профиле с доступом к облаку приложения. Записи твоего голоса и подробная история из Anki остаются на этом устройстве и в резервную копию не включаются.</p>
        {user && <details className="fold"><summary>Перенести словарь, который был без входа</summary>
          <p>Добавит словарь и результаты повторений в текущий профиль. История Anki и записи также станут доступны в нём на этом устройстве, без загрузки в облако. Сначала проверь email выше. Уже существующие записи профиля имеют приоритет; исходные данные без входа сохранятся.</p>
          <button type="button" disabled={importing} onClick={importGuest}>{importing ? 'Переносим…' : 'Добавить данные без входа в этот профиль'}</button>
        </details>}
      </section>
      {!!document.conflicts.length && <section className="resource" aria-label="Конфликты синхронизации">
        <h2>Выбрать версию · {document.conflicts.length}</h2>
        <p>Эти записи изменились на двух устройствах. Облачная версия используется сейчас; твой вариант сохранён здесь и в резервной копии.</p>
        {document.conflicts.map(conflict => <article className="profile-conflict" key={conflict.id}>
          <p>{new Date(conflict.at).toLocaleString('ru')}</p>
          <details className="fold"><summary>Сравнить варианты</summary><h3>На этом устройстве</h3><pre>{JSON.stringify(conflict.local,null,2)}</pre><h3>В облаке</h3><pre>{JSON.stringify(conflict.remote,null,2)}</pre></details>
          <div className="actions"><button type="button" onClick={() => { void store.resolve(conflict.id,true).catch(() => notify('Не удалось сохранить выбор.')); }}>Использовать мой вариант</button><button type="button" onClick={() => { void store.resolve(conflict.id,false).catch(() => notify('Не удалось сохранить выбор.')); }}>Оставить облачный</button></div>
        </article>)}
      </section>}
      <section className="resource" aria-label="Данные и статистика"><h2>Данные и статистика</h2><p>Для статистики используются число зарегистрированных аккаунтов и даты входа из системы авторизации. Слова, ответы, ошибки и история Anki для статистики не собираются. Общие уроки загружаются с сайта.</p></section>
      <CloudSettings />
    </div>
  </>;
}
