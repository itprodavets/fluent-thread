import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useWorkspace } from '../context';
import { saveTranscriptPhrase } from '../domain/lesson-transcript';
import type { TranscriptLine } from '../domain/lesson-transcript';

export function useTranscriptPhraseForm({ language, topicId }: { language: string; topicId?: string }) {
  const { notify, update } = useWorkspace();
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [line, setLine] = useState<TranscriptLine>();
  const [title, setTitle] = useState('');
  const [meaning, setMeaning] = useState('');
  const [saving, setSaving] = useState(false);
  function open(value: TranscriptLine) {
    setLine(value);
    setTitle(value.en);
    setMeaning(value.ru);
    dialog.current?.showModal();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const level = submitter?.value;
    if (!line || saving || (level !== 'active' && level !== 'passive') || !title.trim() || !meaning.trim()) return;
    setSaving(true);
    try {
      if (!await update(current => saveTranscriptPhrase(current, {
        language, title, meaning, example: title.trim() === line.en ? '' : line.en, level, topicId
      }))) return;
      dialog.current?.close();
      notify(level === 'active' ? 'Фраза в активном словаре' : 'Фраза в пассивном словаре');
    } finally {
      setSaving(false);
    }
  }

  return {
    open,
    editor: <dialog ref={dialog} className="material-dialog" aria-labelledby={heading}
      onCancel={event => { if (saving) event.preventDefault(); }}>
      <h2 id={heading}>Сохранить фразу</h2>
      <form onSubmit={save}>
        <label>Фраза <textarea lang={language} required rows={3} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Перевод <textarea lang="ru" required rows={3} value={meaning} onChange={event => setMeaning(event.target.value)} /></label>
        <div className="actions">
          <button type="submit" className="primary" value="active" disabled={saving}>В активный</button>
          <button type="submit" value="passive" disabled={saving}>В пассивный</button>
          <button type="button" disabled={saving} onClick={() => dialog.current?.close()}>Отмена</button>
        </div>
      </form>
    </dialog>
  };
}
