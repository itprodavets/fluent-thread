export type PublicCloudConfig = { url: string; key: string };
export const cloudConfigKey = 'fluent-thread-cloud-config-v1';
export type ConfigStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type CloudSelection = { kind: 'default' | 'custom' | 'none' | 'invalid'; config?: PublicCloudConfig; error?: string };
function isPublicKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'anon'; }
  catch { return false; }
}
export function normalizeCloudConfig(value: PublicCloudConfig): PublicCloudConfig {
  let url: URL;
  try { url = new URL(value.url.trim()); } catch { throw new Error('Укажи корректный HTTPS-адрес проекта Supabase.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('Нужен HTTPS-адрес проекта без пароля, пути и параметров. Например: https://project.supabase.co');
  const key = value.key.trim();
  if (!isPublicKey(key)) throw new Error('Нужен публичный publishable или anon key. Пароль базы и secret/service_role сюда не подходят.');
  return { url: url.origin, key };
}
export function readCloudSelection(storage: Pick<ConfigStorage,'getItem'>, defaults?: PublicCloudConfig): CloudSelection {
  try {
    const saved = storage.getItem(cloudConfigKey);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      return { kind: 'custom', config: normalizeCloudConfig(parsed) };
    }
    return defaults ? { kind: 'default', config: normalizeCloudConfig(defaults) } : { kind: 'none' };
  } catch { return { kind: 'invalid', error: 'Не удалось прочитать настройки облака. Проверь их в разделе «Своя база Supabase».' }; }
}
export function saveCloudSelection(storage: ConfigStorage, config?: PublicCloudConfig) {
  if (config) storage.setItem(cloudConfigKey, JSON.stringify(normalizeCloudConfig(config)));
  else storage.removeItem(cloudConfigKey);
}
export function profileOwner(config: PublicCloudConfig, userId: string) {
  return new URL(config.url).origin + ':' + userId;
}
