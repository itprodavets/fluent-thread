import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncTransport } from './profile-store';
import { readCloudSelection } from './cloud-config';
const defaultUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const defaultKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const defaultCloudConfig = defaultUrl && defaultKey ? { url: defaultUrl, key: defaultKey } : undefined;
export const cloudSelection = readCloudSelection({ getItem: key => localStorage.getItem(key) }, defaultCloudConfig);
export const cloud: SupabaseClient | undefined = cloudSelection.config ? createClient(cloudSelection.config.url, cloudSelection.config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
    storageKey: 'fluent-thread-auth:' + new URL(cloudSelection.config.url).origin }
}) : undefined;
export function cloudTransport(client: SupabaseClient, owner: string): SyncTransport {
  return {
    async pull(cursor) {
      const { data, error } = await client.from('study_records').select('id,value,revision')
        .eq('user_id', owner).gt('revision', cursor).order('revision', { ascending: true }).limit(200);
      if (error) throw new Error('Не удалось получить данные из облака. Повторим позже.');
      return data ?? [];
    },
    async push(batch) {
      const { data, error } = await client.rpc('sync_study', { changes: batch.changes, mutation: batch.mutation, owner_id: owner });
      if (error) throw new Error('Не удалось отправить изменения. Они сохранены на устройстве; проверь подключение и вход в профиль.');
      if (!data || !Array.isArray(data.applied) || !Array.isArray(data.conflicts)) throw new Error('Облако вернуло неожиданный ответ.');
      return data;
    }
  };
}
