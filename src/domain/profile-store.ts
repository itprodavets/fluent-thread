import { equal, pendingChanges, reconcileRows, resolveConflict } from './profile-sync.ts';
import type { Change, CloudRow, ProfileDocument } from './profile-sync.ts';
import type { Study } from './model.ts';
export type Outbox = { mutation: string; changes: Change[] };
export type StoredProfile = ProfileDocument & { outbox?: Outbox };
export interface SyncTransport {
  pull(cursor: number): Promise<CloudRow[]>;
  push(batch: Outbox): Promise<{ applied: CloudRow[]; conflicts: CloudRow[] }>;
}
export type SyncState = { state: 'local' | 'pending' | 'syncing' | 'synced' | 'error'; message?: string; lastSync?: number };

export class ProfileStore {
  readonly owner: string;
  document: StoredProfile;
  status: SyncState = { state: 'local' };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private running = false;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private persist: (value: StoredProfile) => Promise<void>;
  private transport?: SyncTransport;
  constructor(owner: string, document: StoredProfile, persist: (value: StoredProfile) => Promise<void>, transport?: SyncTransport) {
    this.persist = persist; this.transport = transport;
    this.owner = owner; this.document = document;
    if (transport) this.status = { state: 'pending' };
  }
  setTransport(transport?: SyncTransport) {
    if (this.transport === transport || (this.transport && transport)) return;
    this.transport = transport;
    if (transport) { this.mark('pending'); this.schedule(); }
    else { clearTimeout(this.timer); this.mark('local'); }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getStudy = () => this.document.study;
  getDocument = () => this.document;
  getStatus = () => this.status;
  private emit() { for (const listener of this.listeners) listener(); }
  private mark(state: SyncState['state'], message?: string) { this.status = { ...this.status, state, message }; this.emit(); }
  private transaction(change: (doc: StoredProfile) => StoredProfile) {
    const task = this.queue.then(async () => {
      if (this.disposed) return false;
      const next = change(this.document);
      if (next === this.document) return true;
      // Cursor-only advances are checkpointed by the next durable write. Replayed rows
      // are ignored by their persisted base revisions after a restart.
      const keys = Object.keys({ ...this.document, ...next }) as (keyof StoredProfile)[];
      if (keys.some(key => key !== 'cursor' && next[key] !== this.document[key])) await this.persist(next);
      this.document = next;
      if (!this.disposed) this.emit();
      return !this.disposed;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async update(change: (study: Study) => Study) {
    const saved = await this.transaction(doc => {
      const study = change(doc.study); return study === doc.study ? doc : { ...doc, study };
    });
    if (saved && this.transport) { this.mark('pending'); this.schedule(); }
    return saved;
  }
  async resolve(id: string, keepLocal: boolean) {
    await this.transaction(doc => ({ ...doc, ...resolveConflict(doc, id, keepLocal) }));
    if (keepLocal) this.schedule();
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.disposed) this.timer = setTimeout(() => { void this.sync(); }, 1200);
  }
  async sync() {
    if (this.running || this.disposed || !this.transport) return;
    const transport = this.transport;
    this.running = true; this.mark('syncing');
    try {
      for (let round = 0; round < 20 && !this.disposed && this.transport === transport; round++) {
        // Durable outbox is retried BEFORE pulling: a lost HTTP response cannot double-count practice.
        const pending = this.document.outbox;
        if (pending) {
          const reply = await transport.push(pending);
          if (this.disposed || this.transport !== transport) return;
          await this.transaction(doc => {
            const sent = new Map(pending.changes.map(change => [change.id, change.value]));
            const applied = reconcileRows(doc, reply.applied, sent);
            const merged = reconcileRows(applied, reply.conflicts);
            return { ...doc, ...merged, outbox: undefined };
          });
          continue;
        }
        let page: CloudRow[];
        do {
          page = await transport.pull(this.document.cursor);
          if (this.disposed || this.transport !== transport) return;
          if (page.length) await this.transaction(doc => ({ ...doc, ...reconcileRows(doc, page), cursor: Math.max(doc.cursor, ...page.map(row => row.revision)) }));
        } while (page.length === 200 && !this.disposed);
        if (this.disposed || this.transport !== transport) return;
        const changes = pendingChanges(this.document);
        if (!changes.length) {
          this.status = { state: 'synced', lastSync: Date.now() }; this.emit(); return;
        }
        const batch: Change[] = []; let bytes = 0;
        for (const change of changes) {
          const size = new TextEncoder().encode(JSON.stringify(change)).length;
          if (size > 6_000_000) throw new Error('Одна запись больше 6 МБ. Скачай резервную копию и уменьши этот материал.');
          if (batch.length && (batch.length >= 200 || bytes + size > 6_000_000)) break;
          batch.push(change); bytes += size;
        }
        await this.transaction(doc => ({ ...doc, outbox: { mutation: crypto.randomUUID(), changes: batch } }));
      }
      if (!this.disposed && this.transport === transport) { this.mark('pending'); this.schedule(); }
    } catch (error) {
      if (!this.disposed && this.transport === transport) this.mark('error', error instanceof Error ? error.message : 'Не удалось синхронизировать. Изменения сохранены на устройстве.');
    } finally { this.running = false; }
  }
  async flush() { await this.queue; }
  dispose() { this.disposed = true; clearTimeout(this.timer); this.listeners.clear(); }
}
