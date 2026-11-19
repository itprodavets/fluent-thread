import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncTransport } from './profile-store';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function publicKey(value: string) {
  if (value.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(value.split('.')[1])).role === 'anon'; } catch { return false; }
}
export const cloudConfigured = Boolean(url && key && publicKey(key) && /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url));
export const cloud: SupabaseClient | undefined = cloudConfigured ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
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
