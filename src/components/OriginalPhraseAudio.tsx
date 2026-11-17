import { useEffect, useRef, useState } from 'react';
import { usePhraseAudio } from '../hooks/use-phrase-audio';
import { recordingTime } from '../domain/lesson-transcript';
import type { PhraseAudioSource } from '../domain/lesson-transcript';

export function OriginalPhraseAudio({ source, onPlayChange, disabled }: {
  source: PhraseAudioSource;
  onPlayChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const { url, ready, notice, setNotice, pick } = usePhraseAudio(source.recordingKey);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const player = audio.current;
    const timer = window.setInterval(() => {
      if (player && player.currentTime >= source.end) player.pause();
    }, 25);
    return () => window.clearInterval(timer);
  }, [playing, source.end]);
  function changed(value: boolean) {
    setPlaying(value);
    onPlayChange(value);
  }
  async function play() {
    const player = audio.current;
    if (!player) return;
    if (playing) { player.pause(); return; }
    if (!Number.isFinite(player.duration)) {
      setNotice('Аудиофайл ещё загружается. Попробуй снова через секунду.');
      return;
    }
    if (source.start >= player.duration || source.end > player.duration + .1) {
      setNotice('Этот таймкод выходит за пределы файла. Выбери исходную запись урока.');
      return;
    }
    setNotice('');
    player.currentTime = source.start;
    try { await player.play(); }
    catch { changed(false); setNotice('Не удалось воспроизвести фрагмент.'); }
  }
  return <div className="phrase-original">
    {url && <audio ref={audio} src={url} preload="metadata" aria-label="Оригинал из урока"
      onPlay={() => changed(true)} onPause={() => changed(false)} onEnded={() => changed(false)}
      onError={() => { changed(false); setNotice('Не удалось открыть эту запись.'); }} />}
    <div className="actions">
      <button type="button" disabled={disabled || !url} aria-pressed={playing} onClick={() => void play()}>
        {playing ? 'Остановить оригинал' : '▶ Послушать оригинал'}
      </button>
      <span className="sub">{recordingTime(source.start)}–{recordingTime(source.end)}</span>
    </div>
    {ready && (!url || notice) && <label>{url ? 'Заменить аудиозапись урока' : 'Выбрать аудиозапись урока'}
      <input type="file" accept="audio/*,.wav" disabled={disabled} onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        audio.current?.pause();
        changed(false);
        pick(file);
      }} />
    </label>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
