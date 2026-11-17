export type TranscriptLine = {
  start: number;
  end: number;
  en: string;
  ru: string;
  teacher?: boolean;
};

export function recordingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = Math.floor(seconds) % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
}

export function lineAtTime(lines: TranscriptLine[], position: number) {
  for (let index = lines.length - 1; index >= 0; index--) {
    const { start, end } = lines[index];
    if (start <= position && position < end) return index;
  }
  return -1;
}
