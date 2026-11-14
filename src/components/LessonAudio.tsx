import { useEffect, useRef, useState } from 'react';
import { lessonCues } from '../domain/lesson-cues';

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

export function LessonAudio({ cues, lesson, language }: { cues: ReturnType<typeof lessonCues>; lesson: string; language: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const range = useRef<{ start: number; end: number; remaining: number } | null>(null);
  const [blob, setBlob] = useState<Blob>();
  const [url, setUrl] = useState('');
  const [speed, setSpeed] = useState(1);
  const [repeats, setRepeats] = useState(3);
  const [selected, select] = useState<number>();
  const [notice, setNotice] = useState('');
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
  function play(index: number) {
    const player = audio.current;
    if (!player) return;
    if (selected === index && !player.paused) {
      player.pause(); range.current = null; select(undefined); return;
    }
    const cue = cues[index];
    if (!Number.isFinite(player.duration) || cue.start >= player.duration) {
      setNotice('Запись ещё загружается или выбран файл от другого урока.'); return;
    }
    range.current = { start: cue.start, end: Math.min(cue.end, player.duration), remaining: repeats };
    player.currentTime = cue.start;
    player.playbackRate = speed;
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
    {url && <audio ref={audio} src={url} preload="metadata" onEnded={() => { range.current = null; select(undefined); }} onError={() => setNotice('Этот аудиофайл не удалось открыть.')} />}
    <ol className="lesson-cues">{cues.map((cue, index) => <li key={index}>
      <button type="button" disabled={!url} aria-pressed={selected === index} onClick={() => play(index)}>
        <span>{selected === index ? '■' : '▶'} {cue.time}</span><span lang={language}>{cue.label}</span>
      </button>
    </li>)}</ol>
  </section>;
}
