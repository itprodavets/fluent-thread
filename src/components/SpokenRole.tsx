import { localOwner } from '../domain/profile-local';
import { captureAnswer } from '../domain/auto-answer';
import { localSpeechAvailability, transcribeLocally } from '../domain/local-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../context';
import type { Resource } from '../domain/model';
import { dialogueLines, roleTurns } from '../domain/role-play';
import { inspectSpeech } from '../domain/speech-feedback';
import { saveTake, speak, stopSpeaking } from '../domain/voice.js';
import { copyText, Fold } from './common';
import { Recording } from './Recording';

export function SpokenRole({ resource }: { resource: Resource }) {
  const { notify } = useWorkspace();
  const lines = useMemo(() => dialogueLines(resource.text), [resource.text]);
  const roles = [...new Set(lines.map(line => line.speaker))];
  const [role, choose] = useState(roles.find(name => /^(denis|learner|student|ученик)$/i.test(name)) ?? roles[1] ?? '');
  const [automatic, setAutomatic] = useState(false);
  const [autoPhase, setAutoPhase] = useState('');
  const [autoError, setAutoError] = useState('');
  const [reviewPending, setReviewPending] = useState(0);
  const autoSession = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => autoSession.current?.abort(), []);
  const [run, setRun] = useState('');
  const [index, setIndex] = useState(0);
  const [hasTake, setHasTake] = useState(false);
  const [recording, setRecording] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [reviewAudio, setReviewAudio] = useState<number>();
  const [visible, show] = useState(false);
  const { responses, closing } = roleTurns(lines, role);
  const current = responses[index];
  const prompt = current?.partner.map(line => line.text).join('\n') ?? '';
  const id = (i: number) => 'lesson-role:' + run + ':' + i;
  useEffect(() => stopSpeaking, []);
  useEffect(() => {
    if (!run || autoSession.current) return;
    const next = roleTurns(lines, role);
    const text = (next.responses[index]?.partner ?? next.closing).map(line => line.text).join('\n');
    if (!text) return;
    setReplaying(true);
    speak(text, resource.language, false, notify, () => setReplaying(false));
  }, [run, index, lines, role, resource.language, notify, automatic]);

  async function startAutomatic(attempt: string) {
    const owner = localOwner();
    const controller = new AbortController();
    autoSession.current = controller;
    const { signal } = controller;
    const takes: Blob[] = [];
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    function stopMic() {
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    }
    signal.addEventListener('abort', stopMic, { once: true });
    function say(text: string) {
      if (!text) return Promise.resolve();
      setAutoPhase('Собеседник говорит');
      return new Promise<void>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        speak(text, resource.language, false, notify, ok => {
          signal.removeEventListener('abort', abort);
          if (ok) resolve();
          else reject(new Error('Не удалось озвучить реплику. Её можно открыть в ручном режиме.'));
        });
      });
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.AudioContext || !window.speechSynthesis) {
        throw new Error('Этот браузер не поддерживает автоматическую запись и озвучку.');
      }
      context = new AudioContext();
      setAutoPhase('Запрашиваем микрофон');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      signal.throwIfAborted();
      for (let i = 0; i < responses.length; i++) {
        setIndex(i);
        await say(responses[i].partner.map(line => line.text).join('\n'));
        signal.throwIfAborted();
        setAutoPhase('Слушаю твой ответ');
        const blob = await captureAnswer(context, stream, signal);
        signal.throwIfAborted();
        if (!blob) throw new Error('Ответ не удалось услышать. Продолжи с текущей реплики вручную.');
        await saveTake('lesson-role:' + attempt + ':' + i, blob, owner);
        signal.throwIfAborted();
        takes.push(blob);
      }
      stopMic();
      await say(closing.map(line => line.text).join('\n'));
      signal.throwIfAborted();
      setIndex(responses.length);
      setAutoPhase('');
      if (await localSpeechAvailability(resource.language) !== 'available' || signal.aborted) return;
      setReviewPending(takes.length);
      for (const [i, blob] of takes.entries()) {
        if (signal.aborted) break;
        const text = await transcribeLocally(blob, resource.language, signal).catch(() => '');
        if (signal.aborted) break;
        if (text) setAnswers(previous => previous[i]?.trim() ? previous : Object.assign([...previous], { [i]: text }));
        setReviewPending(n => n - 1);
      }
    } catch (error) {
      if (!signal.aborted) {
        setAutoError(error instanceof Error && error.name !== 'NotAllowedError' ? error.message : 'Разреши доступ к микрофону или продолжи вручную.');
        setAutoPhase('');
      }
    } finally {
      stopMic();
      signal.removeEventListener('abort', stopMic);
    }
  }
  function manual() {
    autoSession.current?.abort();
    autoSession.current = undefined;
    stopSpeaking();
    setAutomatic(false); setAutoPhase(''); setReviewPending(0); setReplaying(false);
  }

  function playback(text: string, slow = false) {
    if (!text) return;
    setReplaying(true);
    speak(text, resource.language, slow, notify, () => setReplaying(false));
  }
  const saveText = (text: string) => setAnswers(previous => {
    const next = [...previous];
    next[index] = text;
    return next;
  });

  if (!roles.length) return <><p>Для пошаговой озвучки нужны реплики с именами в формате «Имя: текст».</p>
    <Recording itemId={'lesson-role:' + resource.id} language={resource.language} /></>;

  if (!run) return <div className="spoken-role">
    <label>Твоя роль<select value={role} onChange={event => choose(event.target.value)}>
      {roles.map(name => <option key={name}>{name}</option>)}
    </select></label>
    <label className="choice"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Автопереход после паузы</label>
    {automatic && <p className="sub">После реплики включится микрофон. Говори после сигнала «Слушаю твой ответ». Пауза около двух секунд завершит ответ.</p>}
    <button type="button" className="primary" onClick={() => {
      const attempt = crypto.randomUUID();
      setAutoError(''); setRun(attempt); setIndex(0); setReviewAudio(undefined); setAnswers([]); show(false);
      setHasTake(false);
      if (automatic) void startAutomatic(attempt);
    }}>Начать разговор</button>
  </div>;

  if (autoPhase || autoError) return <section className="spoken-role">
    <p role="status">{autoPhase || autoError} · {Math.min(index + 1, responses.length)} из {responses.length}</p>
    <button type="button" onClick={() => { setAutoError(''); manual(); }}>Продолжить вручную</button>
  </section>;

  if (!current) return <section className="spoken-role">
    <h4>Разбор твоих ответов</h4>
    <p className="sub">Проверь расшифровку. Проверка охватывает отдельные правила грамматики. Образец показывает один естественный вариант ответа.</p>
    {!!reviewPending && <p role="status">Расшифровка ответов: осталось {reviewPending}.</p>}
    {closing.length > 0 && <p lang={resource.language}>{closing.map(line => line.text).join(' ')}</p>}
    {responses.map((turn, i) => {
      const text = answers[i]?.trim() ?? '';
      const issues = text ? inspectSpeech(text, [], resource.language).issues : [];
      return <Fold key={i} title={'Ответ ' + (i + 1)} open={i === 0 || undefined}>
        {turn.partner.map((line, j) => <p key={j} lang={resource.language}><strong>{line.speaker}: </strong>{line.text}</p>)}
        <button type="button" onClick={() => setReviewAudio(reviewAudio === i ? undefined : i)}>Моя запись и расшифровка</button>
        {reviewAudio === i && <Recording itemId={id(i)} language={resource.language} readOnly autoTranscript={reviewPending === 0} onTranscript={value => {
            if (value) setAnswers(previous => previous[i]?.trim() ? previous : Object.assign([...previous], { [i]: value }));
          }} />}
        <label>Твой ответ<textarea value={answers[i] ?? ''} lang={resource.language} rows={2} maxLength={6000}
          onChange={event => { const value = event.target.value; setAnswers(previous => Object.assign([...previous], { [i]: value })); }} /></label>
        {issues.map(issue => <p key={issue.start} lang={resource.language}>{text.slice(issue.start, issue.end)} → <strong>{issue.correction}</strong></p>)}
        {text && !issues.length && <p className="sub">По проверяемым правилам ошибок не найдено.</p>}
        <p>Как можно ответить</p><p lang={resource.language}>{turn.model}</p>
      </Fold>;
    })}
    <div className="actions">
      <button type="button" disabled={!answers.some(answer => answer?.trim())} onClick={() => void copyText(
        'Проверь мои ответы на языке ' + resource.language + '. Для каждого ответа покажи конкретные ошибки и предложи естественный вариант с сохранением смысла. Уместные альтернативы не считай ошибками. Отметь возможные ошибки распознавания и не оценивай произношение по тексту.\n' +
        JSON.stringify(responses.map((turn, i) => ({ context: turn.partner, myAnswer: answers[i] ?? '', example: turn.model })), null, 2), notify
      )}>Скопировать ответы для разбора в ИИ-чате</button>
      <button type="button" onClick={() => { manual(); setRun(''); }}>Начать заново</button>
    </div>
  </section>;

  return <section className="spoken-role">
    <p role="status">{replaying ? 'Собеседник говорит' : 'Твой ход'} · {index + 1} из {responses.length}</p>
    {!!prompt && <div className="actions">
      <button type="button" onClick={() => playback(prompt)}>Повторить реплику</button>
      <button type="button" onClick={() => playback(prompt, true)}>Медленнее</button>
      <button type="button" onClick={() => show(!visible)}>{visible ? 'Скрыть реплику' : 'Показать реплику'}</button>
      {replaying && <button type="button" onClick={() => { stopSpeaking(); setReplaying(false); }}>Остановить озвучку</button>}
    </div>}
    {visible && prompt && <p lang={resource.language}>{prompt}</p>}
    <Recording key={index} itemId={id(index)} language={resource.language} onTranscript={text => { if (text) saveText(text); }} autoTranscript onRecordingChange={setRecording} onTakeChange={setHasTake} disabled={replaying} />
    <label>Текст ответа, если нужна ручная расшифровка<textarea lang={resource.language} maxLength={6000}
      value={answers[index] ?? ''} onChange={event => saveText(event.target.value)} rows={2} /></label>
    <div className="actions">
      <button type="button" className="primary" disabled={recording || replaying || (!hasTake && !answers[index]?.trim())} onClick={nextTurn}>
        {index + 1 === responses.length ? 'К разбору →' : 'Следующая реплика →'}
      </button>
      <button type="button" disabled={recording || replaying} onClick={nextTurn}>Пропустить ответ</button>
    </div>
  </section>;
  function nextTurn() {
    stopSpeaking(); show(false); setHasTake(false); setIndex(index + 1);
  }
}
