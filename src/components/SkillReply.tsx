import { useState } from 'react';
import { inspectSkillAnswer } from '../domain/skill-answer';
import type { SkillMatch } from '../domain/skill-dialogues';
import { Recording } from './Recording';
import { Fold, VoiceButtons } from './common';

export function SkillReply({ exercise, skillId, recordingId }: { exercise: SkillMatch; skillId: string; recordingId: string }) {
  const [mode, chooseMode] = useState<'written' | 'spoken'>('written');
  const [written, setWritten] = useState('');
  const [spoken, setSpoken] = useState('');
  const [reviewed, setReviewed] = useState('');
  const [recording, setRecording] = useState(false);
  const value = mode === 'written' ? written : spoken;
  const change = mode === 'written' ? setWritten : setSpoken;
  const feedback = reviewed && reviewed === value.trim() ? inspectSkillAnswer(reviewed, skillId, exercise.role.patterns) : undefined;
  return <section className="skill-reply" aria-label="Твой ход в диалоге">
    <h4>Твой ход в диалоге</h4>
    <div className="skill-partner-line">
      <strong>Собеседник</strong>
      <p lang="en">{exercise.role.line}</p>
      <VoiceButtons text={exercise.role.line} language="en" />
    </div>
    <p lang="en">{exercise.prompt}</p>
    <div className="practice-modes" role="group" aria-label="Способ ответа">
      <button type="button" disabled={recording} aria-pressed={mode === 'written'} onClick={() => { chooseMode('written'); setReviewed(''); }}>Текстом</button>
      <button type="button" aria-pressed={mode === 'spoken'} onClick={() => { chooseMode('spoken'); setReviewed(''); }}>Голосом</button>
    </div>
    {mode === 'spoken' && <>
      <Recording itemId={recordingId} language="en" autoTranscript transcriptOnly onTranscript={setSpoken} onRecordingChange={setRecording} />
      <p className="sub">Перед проверкой сверь расшифровку с записью. Если браузер её не создал, впиши, что сказал.</p>
    </>}
    <form onSubmit={event => { event.preventDefault(); setReviewed(value.trim()); }}>
      <label>{mode === 'written' ? 'Твой ответ' : 'Расшифровка ответа'}
        <textarea lang="en" rows={3} maxLength={6000} value={value} onChange={event => change(event.target.value)} />
      </label>
      <button type="submit" className="primary" disabled={!value.trim() || recording}>Проверить ответ</button>
    </form>
    {feedback && <div className="skill-answer-feedback" aria-label="Разбор ответа">
      <h4>Разбор ответа</h4>
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
      <ul>{exercise.phrases.map(card => <li key={card.phrase}><span lang="en">{card.phrase}</span> · {card.meaning}</li>)}</ul>
    </Fold>
  </section>;
}
