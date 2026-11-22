import type { MapPoint, Study, Topic } from './model';

export function withinCanvas({ x, y }: MapPoint): MapPoint {
  return { x: Math.min(79, Math.max(21, x)), y: Math.min(93, Math.max(7, y)) };
}

export function topicPositions(topics: Topic[]): Map<string, MapPoint> {
  const rows = Math.max(3, Math.ceil(topics.length / 2));
  return new Map(topics.map((topic, index) => [topic.id, topic.position ?? {
    x: index % 2 ? 74 : 26, y: (Math.floor(index / 2) + 0.5) * 100 / rows
  }]));
}

export function topicEdges(topics: Topic[]): { from: string; to: string }[] {
  const known = new Set(topics.map(topic => topic.id));
  const seen = new Set<string>();
  return topics.flatMap(topic => (topic.connections ?? []).flatMap(id => {
    const key = JSON.stringify([topic.id, id].sort());
    if (id === topic.id || !known.has(id) || seen.has(key)) return [];
    seen.add(key);
    return [{ from: topic.id, to: id }];
  }));
}

export function moveTopic(study: Study, id: string, point: MapPoint): Study {
  return { ...study, topics: study.topics.map(topic => topic.id === id ? { ...topic, position: withinCanvas(point) } : topic) };
}

export function connectTopics(study: Study, from: string, to: string): Study {
  const a = study.topics.find(topic => topic.id === from), b = study.topics.find(topic => topic.id === to);
  if (!a || !b || a.id === b.id || a.language !== b.language ||
    a.connections?.includes(to) || b.connections?.includes(from)) return study;
  return { ...study, topics: study.topics.map(topic => topic.id === from
    ? { ...topic, connections: [...(topic.connections ?? []), to] } : topic) };
}

export function disconnectTopics(study: Study, from: string, to: string): Study {
  return { ...study, topics: study.topics.map(topic => topic.id === from || topic.id === to
    ? { ...topic, connections: topic.connections?.filter(id => id !== (topic.id === from ? to : from)) } : topic) };
}
