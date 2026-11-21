import type { StoredProfile } from '../domain/profile-store';

/** Export the currently selected profile, without changing its study or review state. */
export function downloadProfileBackup(document: StoredProfile) {
  const blob = new Blob([JSON.stringify({
    format: 'fluent-thread-profile', version: 1, exportedAt: new Date().toISOString(),
    study: document.study, conflicts: document.conflicts
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = 'fluent-thread-profile-' + new Date().toISOString().slice(0, 10) + '.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
