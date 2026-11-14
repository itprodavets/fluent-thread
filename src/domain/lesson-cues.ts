const cueLine = /^\[(\d{2}):(\d{2}):(\d{2})(?:\.(\d{2}))?(?:–(\d+(?:\.\d+)?))?\]\s+(.+)$/;

export function lessonCues(text: string) {
  const rows = text.split('\n').flatMap(line => {
    const match = cueLine.exec(line);
    if (!match) return [];
    const [, hours, minutes, seconds, fraction, end, label] = match;
    return [{ start: Number(hours)*3600 + Number(minutes)*60 + Number(seconds) + Number(fraction ?? 0)/100, end: end ? Number(end) : undefined, label, time: hours+':'+minutes+':'+seconds }];
  });
  return rows.map((row, i) => {
    const end = row.end ?? rows[i+1]?.start ?? row.start + 3;
    return { ...row, end: end > row.start ? end : row.start + 1 };
  });
}

const englishTopics: Record<string, string> = {
  '14.11 · Выбор ресторана': 'Choosing a Restaurant',
  '14.11 · Сон, инструкции и вежливое обсуждение': 'Sleep Habits and Classroom Discussion',
  '15.11 · Знакомство и уточнения на звонке': 'Introductions and Clarifying Questions',
};

export function lessonTopicTitle(title: string) {
  return englishTopics[title] ?? title;
}
