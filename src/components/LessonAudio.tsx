import { useEffect, useRef, useState } from 'react';
import type { lessonCues } from '../domain/lesson-cues';
import type { TranscriptLine } from '../domain/lesson-transcript';
import { LessonTranscript } from './LessonTranscript';

const transcriptLoaders: Partial<Record<string, () => Promise<{ default: TranscriptLine[] }>>> = {
  'lesson-2026-11-17': () => import('../../materials/2026-11-17/transcript.json')
};

function recording(key: string, file?: File): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nit-rechi-lesson-audio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recordings');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('recordings', file ? 'readwrite' : 'readonly');
      const store = tx.objectStore('recordings');
      const result = file ? store.put(file, key) : store.get(key);
      tx.oncomplete = () => { db.close(); resolve(file ?? result.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

export function LessonAudio({ cues, lesson, language, topicId }: { cues: ReturnType<typeof lessonCues>; lesson: string; language: string; topicId?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const range = useRef<{ start: number; end: number; remaining: number } | null>(null);
  const [blob, setBlob] = useState<Blob>();
  const [url, setUrl] = useState('');
  const [speed, setSpeed] = useState(1);
  const [repeats, setRepeats] = useState(3);
  const [selected, select] = useState<number>();
  const [notice, setNotice] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>();
  const [chapter, setChapter] = useState(0);
  const [position, setPosition] = useState<number>();
  useEffect(() => {
    const load = transcriptLoaders[lesson];
    if (!load) return;
    let active = true;
    load().then(module => { if (active) setTranscript(module.default); })
      .catch(() => { if (active) setNotice('Не удалось загрузить расшифровку.'); });
    return () => { active = false; };
  }, [lesson]);
  useEffect(() => {
    let active = true;
    recording(lesson).then(value => { if (active && value) setBlob(value); }).catch(() => {});
    return () => { active = false; };
  }, [lesson]);
  useEffect(() => {
    if (!blob) return;
    const source = URL.createObjectURL(blob);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [blob]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = speed; }, [speed, url]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = audio.current;
      const clip = range.current;
      if (!player || !clip || player.paused || player.currentTime < clip.end) return;
      if (--clip.remaining > 0) player.currentTime = clip.start;
      else { player.pause(); range.current = null; select(undefined); }
    }, 25);
    return () => clearInterval(timer);
  }, []);
  function syncPosition(time: number) {
    if (!transcript) return;
    setPosition(time);
    const index = cues.findIndex(cue => cue.start <= time && time < cue.end);
    if (index >= 0) setChapter(index);
  }
  function chooseChapter(index: number) {
    setChapter(index);
    setPosition(undefined);
    range.current = null;
    const player = audio.current;
    if (!player) return;
    player.pause();
    if (Number.isFinite(player.duration) && cues[index].start < player.duration) player.currentTime = cues[index].start;
  }
  function playRange(start: number, end: number, index?: number) {
    const player = audio.current;
    if (!player) return;
    if (index !== undefined && selected === index && !player.paused) {
      player.pause(); range.current = null; select(undefined); return;
    }
    if (!Number.isFinite(player.duration) || start >= player.duration) {
      setNotice('Запись ещё загружается или выбран файл от другого урока.'); return;
    }
    range.current = { start, end: Math.min(end, player.duration), remaining: repeats };
    player.currentTime = start;
    player.playbackRate = speed;
    syncPosition(start);
    select(index);
    setNotice('');
    void player.play().catch(() => { range.current = null; select(undefined); setNotice('Не удалось воспроизвести запись.'); });
  }
  return <section className="lesson-audio">
    <div className="lesson-audio-controls">
      <label>{blob ? 'Заменить запись урока' : 'Выбрать оригинальную запись'}<input type="file" accept="audio/*,.wav" onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        range.current = null;
        audio.current?.pause(); select(undefined);
        setPosition(undefined);
        setBlob(file);
        setNotice('');
        void recording(lesson, file).catch(() => setNotice('Запись доступна сейчас. Для хранения не хватило места или браузер его ограничил.'));
      }} /></label>
      <label>Скорость<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
        {[0.5, 0.65, 0.75, 0.9, 1, 1.15].map(value => <option key={value} value={value}>{value}×</option>)}
      </select></label>
      <label>Повторы<select value={repeats} onChange={event => setRepeats(Number(event.target.value))}>
        {[1, 2, 3, 5, 10].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
    </div>
    {notice && <p role="status">{notice}</p>}
    {url && <audio ref={audio} src={url} preload="metadata" controls={!!transcript}
      onTimeUpdate={event => syncPosition(event.currentTarget.currentTime)}
      onSeeking={event => {
        const clip = range.current;
        const time = event.currentTarget.currentTime;
        if (clip && (time < clip.start || time >= clip.end)) range.current = null;
        syncPosition(time);
      }} onEnded={() => { range.current = null; select(undefined); }} onError={() => setNotice('Этот аудиофайл не удалось открыть.')} />}
    {transcript ? <LessonTranscript cues={cues} lines={transcript} chapterIndex={chapter}
      position={position} language={language} topicId={topicId} ready={!!url} chooseChapter={chooseChapter} play={playRange} />
      : <ol className="lesson-cues">{cues.map((cue, index) => <li key={index}>
      <button type="button" disabled={!url} aria-pressed={selected === index} onClick={() => playRange(cue.start, cue.end, index)}>
        <span>{selected === index ? '■' : '▶'} {cue.time}</span><span lang={language}>{cue.label}</span>
      </button>
    </li>)}</ol>}
  </section>;
}
