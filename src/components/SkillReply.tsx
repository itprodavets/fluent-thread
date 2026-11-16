import { useState } from 'react';
import { inspectSkillAnswer, reviewCue } from '../domain/skill-answer';
import { useWorkspace } from '../context';
import { dialogueMistakesHash, dialogueReviewOutcome, reviewDialogueMistake, saveDialogueMistakes } from '../domain/dialogue-mistakes';
import type { DialogueMistake, DialogueScenario } from '../domain/dialogue-mistakes';
import { Recording } from './Recording';
import { Fold, VoiceButtons } from './common';

export function MistakeCorrections({ mistake }: { mistake: DialogueMistake }) {
  return <ul className="speech-corrections">{mistake.corrections.map((item, index) =>
    <li key={index}><span lang="en">{item.before} → <strong>{item.after}</strong></span><p>{item.reason}</p></li>
  )}</ul>;
}

export function SkillReply({ exercise, recordingId, mistake }: { exercise: DialogueScenario; recordingId: string; mistake?: DialogueMistake }) {
  const { update } = useWorkspace();
  const { skillId } = exercise;
  const [saving, setSaving] = useState(false);
  const [mode, chooseMode] = useState<'written' | 'spoken'>('written');
  const [written, setWritten] = useState('');
  const [spoken, setSpoken] = useState('');
  const [reviewed, setReviewed] = useState('');
  const [recording, setRecording] = useState(false);
  const value = mode === 'written' ? written : spoken;
  const change = mode === 'written' ? setWritten : setSpoken;
  const feedback = reviewed && reviewed === value.trim() ? inspectSkillAnswer(reviewed, skillId, exercise.role.patterns) : undefined;
  const result = mistake && feedback ? dialogueReviewOutcome(mistake, reviewed, feedback.corrections) : undefined;

  async function check() {
    const answer = value.trim();
    if (!answer || saving || recording) return;
    const { corrections } = inspectSkillAnswer(answer, skillId, exercise.role.patterns);
    const now = Date.now();
    setSaving(true);
    try {
      if (await update(current => mistake ? reviewDialogueMistake(current, mistake.id, answer, corrections, now)
        : saveDialogueMistakes(current, exercise, answer, corrections, now))) setReviewed(answer);
    } finally { setSaving(false); }
  }

  return <section className="skill-reply" aria-label="Твой ход в диалоге">
    <h4>Твой ход в диалоге</h4>
    <div className="skill-partner-line">
      <strong>Собеседник</strong>
      <p lang="en">{exercise.role.line}</p>
      <VoiceButtons text={exercise.role.line} language="en" />
    </div>
    <p lang="en">{exercise.prompt}</p>
    {mistake && <p className="sub">{reviewCue(mistake.correction.rule)}</p>}
    <div className="practice-modes" role="group" aria-label="Способ ответа">
      <button type="button" disabled={recording} aria-pressed={mode === 'written'} onClick={() => { chooseMode('written'); setReviewed(''); }}>Текстом</button>
      <button type="button" aria-pressed={mode === 'spoken'} onClick={() => { chooseMode('spoken'); setReviewed(''); }}>Голосом</button>
    </div>
    {mode === 'spoken' && <>
      <Recording itemId={recordingId} language="en" autoTranscript transcriptOnly onTranscript={setSpoken} onRecordingChange={setRecording} />
      <p className="sub">Перед проверкой сверь расшифровку с записью. Если браузер её не создал, впиши, что сказал.</p>
    </>}
    <form onSubmit={event => { event.preventDefault(); void check(); }}>
      <label>{mode === 'written' ? 'Твой ответ' : 'Расшифровка ответа'}
        <textarea lang="en" rows={3} maxLength={6000} value={value} onChange={event => change(event.target.value)} />
      </label>
      <button type="submit" className="primary" disabled={!value.trim() || recording || saving}>Проверить ответ</button>
    </form>
    {feedback && <div className="skill-answer-feedback" aria-label="Разбор ответа">
      <h4>Разбор ответа</h4>
      {result === 'fixed' && <p role="status">Конструкция использована без прежней ошибки. Следующее повторение запланировано.</p>}
      {result === 'retry' && <p role="status">Ошибка повторилась. Попробуй ещё раз через 10 минут.</p>}
      {result === 'try-construction' && <p role="status">Пока не удалось проверить нужную конструкцию. Открой подсказку и ответь ещё раз.</p>}
      {mistake && <Fold title="Предыдущая ошибка и исправление">
        <p className="source-text" lang="en">{mistake.original}</p>
        <MistakeCorrections mistake={mistake} />
      </Fold>}
      {!mistake && !!feedback.corrections.length && <p role="status">Ошибки сохранены. Время повторения можно посмотреть в <a href={dialogueMistakesHash}>«Моих ошибках»</a>.</p>}
      {feedback.corrections.length ? <ul className="speech-corrections">{feedback.corrections.map((item, index) =>
        <li key={index}><span lang="en"><mark className="speech-issue">{item.before}</mark> → <strong>{item.after}</strong></span><p>{item.reason}</p></li>
      )}</ul> : <p>В конструкциях, которые проверяет упражнение, ошибок не найдено.</p>}
      {feedback.patterns.some(pattern => pattern.span) &&
        <p>В ответе использовано <strong lang="en">{feedback.patterns.filter(pattern => pattern.span).map(pattern => pattern.target).join(' · ')}</strong></p>}
      {!!feedback.suggestions.length && <>
        <h4>Как сделать твою фразу мягче</h4>
        <ul className="speech-corrections">{feedback.suggestions.map((item, index) =>
          <li key={index}><span lang="en">{item.before} → <strong>{item.after}</strong></span><p>{item.reason}</p></li>
        )}</ul>
      </>}
      <h4>Как можно ответить естественно</h4>
      <p lang="en">{exercise.answer}</p>
      <VoiceButtons text={exercise.answer} language="en" />
      <p className="sub">Пример подходит к ситуации. Свой ответ можно уточнить и проверить ещё раз. Проверка работает по отдельным правилам и охватывает текст.</p>
    </div>}
    <Fold title="Подсказка: фразы для ответа">
      {mistake && <p>{mistake.correction.reason}</p>}
      <ul>{exercise.phrases.map(card => <li key={card.phrase}><span lang="en">{card.phrase}</span> · {card.meaning}</li>)}</ul>
    </Fold>
  </section>;
}
