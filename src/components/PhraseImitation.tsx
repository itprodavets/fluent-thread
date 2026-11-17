import { useState } from 'react';
import type { PhraseAudioSource } from '../domain/lesson-transcript';
import type { Word } from '../domain/model';
import { Fold } from './common';
import { Recording } from './Recording';

export function PhraseImitation({ word, source, takeId, onReveal }: {
  word: Word;
  source: PhraseAudioSource;
  takeId: string;
  onReveal?: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return <div className="phrase-imitation">
    <p className="source-text">Вспомни фразу из урока, произнеси её вслух и сверь себя.</p>
    <Recording itemId={takeId} language={word.language} phraseToCompare={word.title} onRecordingChange={setRecording} />
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
