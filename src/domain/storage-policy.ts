export type StorageMode = 'checking' | 'cloud' | 'local' | 'error';
export function storagePolicyResult(data: unknown, error: { code?: string } | null, legacyPersonalProject: boolean): 'cloud' | 'local' {
  if (!error && (data === 'cloud' || data === 'local')) return data;
  if (error?.code === 'PGRST202' && legacyPersonalProject) return 'cloud';
  throw new Error('Не удалось проверить режим хранения. Данные сохранены на устройстве; проверим подключение снова.');
}
export function isLegacyPersonalProject(kind: string, selectedUrl?: string, defaultUrl?: string) {
  if (kind !== 'custom' || !selectedUrl) return false;
  try { return !defaultUrl || new URL(selectedUrl).origin !== new URL(defaultUrl).origin; }
  catch { return false; }
}
