import { useState } from 'react';
import type { PhraseAudioSource } from '../domain/lesson-transcript';
import type { Word } from '../domain/model';
import { Fold } from './common';
import { OriginalPhraseAudio } from './OriginalPhraseAudio';
import { Recording } from './Recording';

export function PhraseImitation({ word, source, takeId, onReveal }: {
  word: Word;
  source: PhraseAudioSource;
  takeId: string;
  onReveal?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return <div className="phrase-imitation">
    <p className="source-text">Послушай, как прозвучала фраза на уроке. Повтори её вслух и сверь себя.</p>
    <OriginalPhraseAudio key={source.recordingKey} source={source} disabled={recording} onPlayChange={setPlaying} />
    <Recording itemId={takeId} language={word.language} phraseToCompare={word.title} disabled={playing} onRecordingChange={setRecording} />
    {revealed ? <div className="reference">
      <h2 lang={word.language}>{word.title}</h2>
      <p lang="ru">{word.meaning}</p>
      {source.en !== word.title && <Fold title="Вся реплика из записи">
        <p lang={word.language}>{source.en}</p><p lang="ru">{source.ru}</p>
      </Fold>}
    </div> : <button type="button" className="subtle reveal" disabled={recording} onClick={() => {
      setRevealed(true);
      onReveal?.();
    }}>Сверить текст и перевод</button>}
  </div>;
}
