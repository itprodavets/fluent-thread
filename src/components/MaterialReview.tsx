import { useState } from 'react';
import { useWorkspace } from '../context';
import { assessMaterial, materialReviewStatus } from '../domain/material-review';
import type { Outcome, Resource } from '../domain/model';
export function MaterialReviewStatus({ resource }: { resource: Resource }) {
  const { study } = useWorkspace();
  return <span className="sub">{materialReviewStatus(study.results[resource.id],Date.now()).label}</span>;
}
export function MaterialReview({ resource, onRated }: { resource: Resource; onRated?: (now: number) => void }) {
  const { study, update } = useWorkspace();
  const [saving,setSaving] = useState(false);
  const status = materialReviewStatus(study.results[resource.id],Date.now());
  async function rate(outcome: Outcome) {
    if (saving) return;
    setSaving(true);
    const now=Date.now();
    try { if (await update(current => assessMaterial(current,resource,outcome,now))) onRated?.(now); }
    finally { setSaving(false); }
  }
  return <section className="material-review" aria-label="Повторение материала">
    <p role="status"><strong>{status.label}</strong>{status.due !== undefined && <> · Повторение: {new Date(status.due).toLocaleString('ru')}</>}</p>
    <p className="sub">Попробуй ответить или пересказать своими словами, затем оцени себя.</p>
    <div className="actions">
      <button type="button" disabled={saving} onClick={() => void rate('retry')}>Ещё раз · 10 минут</button>
      <button type="button" disabled={saving} onClick={() => void rate('assisted')}>С подсказкой · 1 день</button>
      <button type="button" className="primary" disabled={saving} onClick={() => void rate('independent')}>Самостоятельно</button>
    </div>
    <a href="#today/review">Повторить сегодня →</a>
  </section>;
}
