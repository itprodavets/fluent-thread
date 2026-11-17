import { useEffect, useMemo, useRef } from 'react';
import type { lessonCues } from '../domain/lesson-cues';
import { lineAtTime, recordingTime } from '../domain/lesson-transcript';
import type { TranscriptLine } from '../domain/lesson-transcript';

type Cue = ReturnType<typeof lessonCues>[number];

export function LessonTranscript({ cues, lines, chapterIndex, position, ready, chooseChapter, play }: {
  cues: Cue[];
  lines: TranscriptLine[];
  chapterIndex: number;
  position?: number;
  ready: boolean;
  chooseChapter: (index: number) => void;
  play: (start: number, end: number) => void;
}) {
  const chapter = cues[chapterIndex];
  const chapterLines = useMemo(() => lines.filter(line => line.end > chapter.start && line.start < chapter.end),
    [lines, chapter]);
  const activeIndex = position === undefined ? -1 : lineAtTime(chapterLines, position);
  const pane = useRef<HTMLOListElement>(null);
  const current = useRef<HTMLLIElement>(null);
  useEffect(() => { if (pane.current) pane.current.scrollTop = 0; }, [chapterIndex]);
  useEffect(() => {
    const container = pane.current;
    const row = current.current;
    if (!container || !row) return;
    const bounds = container.getBoundingClientRect();
    const offset = row.getBoundingClientRect().top - bounds.top;
    if (offset < 0 || offset + row.offsetHeight > container.clientHeight) {
      container.scrollTop += offset - 8;
    }
  }, [activeIndex, chapterIndex]);

  return <div className="lesson-transcript">
    <div className="lesson-audio-controls">
      <label>Фрагмент записи
        <select value={chapterIndex} onChange={event => chooseChapter(Number(event.target.value))}>
          {cues.map((cue, index) => <option value={index} key={cue.start}>
            {cue.time} · {cue.label.split(' · ')[0]}
          </option>)}
        </select>
      </label>
      <button type="button" disabled={!ready} onClick={() => play(chapter.start, chapter.end)}>▶ Слушать фрагмент</button>
    </div>
    <p className="sub">Автоматическая расшифровка и перевод. «Брюс» указан там, где его реплику можно выделить. Некоторые строки содержат несколько голосов.</p>
    {chapterLines.length ? <ol aria-label="Расшифровка фрагмента" className="transcript-lines" ref={pane}>
      {chapterLines.map((line, index) => <li key={line.start + '-' + index} ref={index === activeIndex ? current : undefined}
        aria-current={index === activeIndex ? 'true' : undefined}>
        <div className="transcript-line">
          <button type="button" className="transcript-time" disabled={!ready}
            aria-label={'Слушать с ' + recordingTime(line.start)} onClick={() => play(line.start, line.end)}>
            {recordingTime(line.start)}
          </button>
          <div className="transcript-text">
            <p lang="en">{line.teacher && <strong className="transcript-speaker">Bruce: </strong>}{line.en}</p>
            <details><summary>Перевод</summary><p lang="ru">{line.ru}</p></details>
          </div>
        </div>
      </li>)}
    </ol> : <p className="sub">Перерыв. Разговор группы возобновляется в следующем фрагменте.</p>}
  </div>;
}
