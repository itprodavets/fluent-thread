import { useState } from 'react';
import type { FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cloudSelection, defaultCloudConfig } from '../domain/cloud';
import { normalizeCloudConfig, saveCloudSelection } from '../domain/cloud-config';
import type { PublicCloudConfig } from '../domain/cloud-config';
import { useProfileStore } from '../profiles';

async function checkSchema(config: PublicCloudConfig) {
  const client = createClient(config.url, config.key, { auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'fluent-thread-connection-check'
  } });
  const { data, error } = await client.rpc('fluent_thread_schema_version').abortSignal(AbortSignal.timeout(15_000));
  if (error || data !== 1) throw new Error('Не удалось проверить базу. Проверь URL и публичный ключ и установи схему Fluent Thread по инструкции ниже.');
}
export function CloudSettings() {
  const store = useProfileStore();
  const [url, setUrl] = useState(cloudSelection.kind === 'custom' ? cloudSelection.config!.url : '');
  const [key, setKey] = useState(cloudSelection.kind === 'custom' ? cloudSelection.config!.key : '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function check(connect: boolean) {
    setBusy(true); setMessage('');
    try {
      const config = normalizeCloudConfig({ url, key });
      await checkSchema(config);
      if (connect) {
        await store.flush();
        saveCloudSelection(localStorage, config);
        location.reload();
      } else setMessage('База доступна, проверка версии схемы пройдена. Для входа по email в этом проекте также должна быть настроена отправка писем.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройки.'); }
    finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setMessage('');
    try { await store.flush(); saveCloudSelection(localStorage); location.reload(); }
    catch { setMessage('Не удалось сбросить настройки. Проверь доступ к хранилищу браузера.'); setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void check(true); }
  return <details className="resource cloud-settings" open={cloudSelection.kind === 'invalid'}>
    <summary>Своя база Supabase</summary>
    <p>Можно использовать базу приложения или подключить собственный проект Supabase. Словарь и прогресс каждого проекта хранятся отдельно.</p>
    <p className="sub">Сейчас: {cloudSelection.kind === 'custom' ? 'свой проект' : cloudSelection.kind === 'default' ? 'база приложения' : 'без подключения'}{cloudSelection.config && <> · {cloudSelection.config.url}</>}</p>
    {cloudSelection.error && <p role="alert">{cloudSelection.error}</p>}
    <ol><li>Создай проект Supabase и установи <a href="https://github.com/itprodavets/fluent-thread/blob/main/supabase/migrations/202611190001_profiles.sql" target="_blank" rel="noreferrer">схему Fluent Thread ↗</a>.</li>
      <li>Настрой вход по email, отправку писем и адрес возврата: <code>{location.origin + location.pathname}</code>.</li>
      <li>Вставь URL проекта и публичный publishable key или anon key.</li></ol>
    <form onSubmit={submit}>
      <label>URL проекта Supabase<input type="url" required value={url} onChange={event => { setUrl(event.target.value); setMessage(''); }} placeholder="https://project.supabase.co" autoComplete="off" spellCheck={false} maxLength={2048} /></label>
      <label>Публичный publishable / anon key<input required value={key} onChange={event => { setKey(event.target.value); setMessage(''); }} placeholder="sb_publishable_…" autoComplete="off" spellCheck={false} maxLength={4096} /></label>
      <p className="sub">Пароль базы и secret/service_role здесь не используются. Эти настройки сохраняются в данном браузере; на телефоне укажи тот же проект.</p>
      <div className="actions">
        <button type="button" disabled={busy || !url || !key} onClick={() => { void check(false); }}>Проверить базу</button>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Проверяем…' : 'Подключить свою базу'}</button>
      </div>
    </form>
    {(cloudSelection.kind === 'custom' || cloudSelection.kind === 'invalid') && <button type="button" disabled={busy} onClick={reset}>{defaultCloudConfig ? 'Вернуться к базе приложения' : 'Сбросить подключение'}</button>}
    <p className="sub">При смене проекта прежние данные сохраняются на устройстве. Чтобы вернуться к ним, выбери прежнюю базу и войди с тем же email. Перенос данных в другую базу выполняется отдельно.</p>
    <p><a href="https://github.com/itprodavets/fluent-thread/blob/main/supabase/README.md" target="_blank" rel="noreferrer">Подробная инструкция подключения ↗</a></p>
    {message && <p role="status">{message}</p>}
  </details>;
}
