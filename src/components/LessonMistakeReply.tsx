import { useState } from 'react';
import { useWorkspace } from '../context';
import type { DialogueMistake } from '../domain/dialogue-mistakes';
import { assessLessonMistake } from '../domain/lesson-mistakes';
import type { Outcome } from '../domain/model';
import { Recording } from './Recording';
import { VoiceButtons } from './common';

export function LessonMistakeReply({ mistake, recordingId, onReviewed }: {
  mistake: DialogueMistake; recordingId: string; onReviewed?: () => void;
}) {
  const { study, update } = useWorkspace();
  const [mode, setMode] = useState<'written' | 'spoken'>('written');
  const [written, setWritten] = useState('');
  const [spoken, setSpoken] = useState('');
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealed, reveal] = useState(false);
  const value = mode === 'written' ? written : spoken;
  const live = study.dialogueMistakes?.[mistake.id];
  const scheduled = !!live?.last && live.due > Date.now();

  async function score(outcome: Outcome) {
    if (!value.trim() || !revealed || saving || recording || scheduled) return;
    setSaving(true);
    try {
      if (await update(current => assessLessonMistake(current, mistake.id, value, outcome, Date.now()))) onReviewed?.();
    } finally { setSaving(false); }
  }

  return <section className="skill-reply" aria-label="Ответ своими словами и сверка">
    {mistake.source && <p className="sub">Запись 20 ноября · {mistake.source.time} · {mistake.source.kind === 'communication' ? 'Ясность общения' : mistake.source.kind === 'naturalness' ? 'Естественная формулировка' : 'Грамматика'}</p>}
    <div className="skill-partner-line"><strong>Собеседник</strong><p lang="en">{mistake.scenario.role.line}</p>
      <VoiceButtons text={mistake.scenario.role.line} language="en" /></div>
    <p>{mistake.scenario.prompt}</p>
    <p className="sub">Ответь своими словами, затем открой исправление. Точное совпадение с образцом не требуется.</p>
    <div className="practice-modes" role="group" aria-label="Способ ответа">
      <button type="button" disabled={recording} aria-pressed={mode === 'written'} onClick={() => setMode('written')}>Текстом</button>
      <button type="button" disabled={recording} aria-pressed={mode === 'spoken'} onClick={() => setMode('spoken')}>Голосом</button>
    </div>
    {mode === 'spoken' && <><Recording itemId={recordingId} language="en" autoTranscript transcriptOnly onTranscript={setSpoken} onRecordingChange={setRecording} />
      <p className="sub">Проверь расшифровку. Если браузер не распознал речь, впиши свой ответ.</p></>}
    <label>{mode === 'written' ? 'Твой ответ' : 'Расшифровка ответа'}
      <textarea lang="en" rows={3} maxLength={6000} value={value} onChange={event => (mode === 'written' ? setWritten : setSpoken)(event.target.value)} />
    </label>
    {!revealed ? <button type="button" className="primary" disabled={!value.trim() || recording} onClick={() => reveal(true)}>Сверить с исправлением</button> : <>
      <div className="lesson-recall-answer">
        <h4>Формулировка из разбора записи</h4><p className="source-text">{mistake.original}</p>
        <h4>Как можно сказать естественнее</h4><p lang="en">{mistake.correction.after}</p>
        <VoiceButtons text={mistake.correction.after} language="en" />
        <p>{mistake.correction.reason}</p>
        <h4>Проверь свой ответ</h4><ul>{mistake.checklist?.map(point => <li key={point}>{point}</li>)}</ul>
        {mistake.last && <><h4>Твой предыдущий ответ</h4><p lang="en">{mistake.last.answer}</p></>}
        <p className="sub">Это самостоятельная сверка по смыслу и конструкции. Приложение не выставляет автоматическую оценку свободной переформулировке.</p>
      </div>
      <div className="actions daily-review-actions">
        <button type="button" disabled={saving || recording || !value.trim() || scheduled} onClick={() => void score('retry')}>Ошибка осталась · 10 минут</button>
        <button type="button" disabled={saving || recording || !value.trim() || scheduled} onClick={() => void score('assisted')}>Исправил с подсказкой · 1 день</button>
        <button type="button" className="primary" disabled={saving || recording || !value.trim() || scheduled} onClick={() => void score('independent')}>Исправил самостоятельно</button>
      </div>
    </>}
    {scheduled && <p role="status">Ответ и самооценка сохранены. Следующее повторение — {new Intl.DateTimeFormat('ru', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(live!.due)}.</p>}
  </section>;
}
