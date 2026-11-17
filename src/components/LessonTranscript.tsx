import { useEffect, useMemo, useRef, useState } from 'react';
import type { lessonCues } from '../domain/lesson-cues';
import { recordingTime } from '../domain/lesson-transcript';
import type { TranscriptLine } from '../domain/lesson-transcript';

import { transcriptLoaders } from '../domain/lesson-text';
import { useTranscriptPhraseForm } from './TranscriptPhraseForm';

type Cue = ReturnType<typeof lessonCues>[number];

export function LessonTranscript({ cues, language, topicId, recordingKey }: {
  cues: Cue[]; language: string; topicId?: string; recordingKey: string;
}) {
  const { editor, open } = useTranscriptPhraseForm({ language, topicId, recordingKey });
  const [chapterIndex, chooseChapter] = useState(0);
  const [lines, setLines] = useState<TranscriptLine[]>();
  const [error, setError] = useState(false);
  const load = transcriptLoaders[recordingKey];
  useEffect(() => {
    if (!load) return;
    let alive = true;
    load().then(module => { if (alive) setLines(module.default); },
      () => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [load]);
  const chapter = cues[chapterIndex];
  const chapterLines = useMemo(() => lines?.filter(line => line.end > chapter.start && line.start < chapter.end),
    [lines, chapter]);
  const pane = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pane.current) pane.current.scrollTop = 0; }, [chapterIndex]);
  return <div className="lesson-transcript">
    {editor}
    <div className="lesson-transcript-controls">
      <label>Фрагмент урока
        <select value={chapterIndex} onChange={event => chooseChapter(Number(event.target.value))}>
          {cues.map((cue, index) => <option value={index} key={cue.start}>
            {cue.time} · {cue.label.split(' · ')[0]}
          </option>)}
        </select>
      </label>

    </div>
    <p className="sub">Автоматическая расшифровка и перевод. Имя преподавателя указано там, где его реплику можно выделить. Некоторые строки содержат несколько голосов.</p>
    {error ? <p role="status">Не удалось загрузить расшифровку.</p> : !load ? <p lang={language}>{chapter.label}</p>
      : !chapterLines ? <p role="status">Загружаем расшифровку…</p> : chapterLines.length ? <ol aria-label="Расшифровка фрагмента" className="transcript-lines" ref={pane}>
      {chapterLines.map((line, index) => <li key={line.start + '-' + index}>
        <div className="transcript-line">
          <time className="transcript-time">{recordingTime(line.start)}</time>
          <div className="transcript-text">
            <p lang="en">{line.teacher && <strong className="transcript-speaker">{line.teacher === true ? 'Bruce' : line.teacher}: </strong>}{line.en}</p>
            <div className="transcript-actions">
              <details><summary>Перевод</summary><p lang="ru">{line.ru}</p></details>
              <button type="button" onClick={() => open(line)}>В словарь</button>
            </div>
          </div>
        </div>
      </li>)}
    </ol> : <p className="sub">Перерыв. Разговор группы возобновляется в следующем фрагменте.</p>}
  </div>;
}
