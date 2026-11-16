import { useEffect, useState } from 'react';
import { SpeechFeedback } from './SpeechFeedback';
import { useWorkspace } from '../context';
import { deleteTake, getTake, isRecording, stopVoice, toggleRecording } from '../domain/voice.js';

export function Recording({ itemId, language, targets = [], onTranscript, readOnly = false, autoTranscript = false, transcriptOnly = false, onRecordingChange, onTakeChange, disabled = false }: { itemId: string; language: string; targets?: string[]; onTranscript?: (text: string) => void; readOnly?: boolean; autoTranscript?: boolean; transcriptOnly?: boolean; onRecordingChange?: (value: boolean) => void; onTakeChange?: (value: boolean) => void; disabled?: boolean }) {
  const { notify } = useWorkspace();
  const [revision, refresh] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string }>();
  const [recording, setRecording] = useState(false);
  useEffect(() => () => stopVoice(), []);
  useEffect(() => {
    let active = true;
    let source: string | undefined;
    getTake(itemId).then(blob => {
      if (!active) return;
      source = blob ? URL.createObjectURL(blob) : undefined;
      setTake(blob && source ? { blob, url: source } : undefined);
    }, () => { if (active) setTake(undefined); });
    return () => { active = false; if (source) URL.revokeObjectURL(source); };
  }, [itemId, revision]);
  useEffect(() => onTakeChange?.(!!take), [take, onTakeChange]);
  const record = () => toggleRecording(itemId, (message: string) => {
    notify(message);
    setRecording(isRecording());
    onRecordingChange?.(isRecording());
    refresh(value => value + 1);
  });
  async function clear() {
    try { await deleteTake(itemId); refresh(value => value + 1); notify('Запись удалена.'); }
    catch { notify('Не удалось удалить запись.'); }
  }
  return <div className="recording">
    {!readOnly && <button type="button" aria-pressed={recording} disabled={disabled && !recording} onClick={record}>{recording ? 'Остановить запись' : 'Записать ответ'}</button>}
    {take && !recording && <><div className="take"><audio controls preload="metadata" aria-label="Твоя запись" src={take.url} />{!readOnly && <button type="button" className="subtle" onClick={clear}>Удалить запись</button>}</div>
      {(!readOnly || autoTranscript) && <SpeechFeedback key={take.url} recording={take.blob} language={language} targets={targets} onTranscript={onTranscript} autoTranscript={autoTranscript} transcriptOnly={transcriptOnly} />}</>}
  </div>;
}
