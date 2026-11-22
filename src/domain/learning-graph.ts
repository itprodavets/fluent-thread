import type { MapPoint, Study } from './model';
import { dialogueChoices, importedLessonsFor } from './imported-lessons.ts';
import { lessonSource } from './school-lessons.ts';
import type { DatedLesson } from './school-lessons';
import type { Skill } from './skill-dialogues';
import type { Level } from './starter-materials';
import { connectTopics, disconnectTopics, moveTopic, topicEdges, topicPositions, withinCanvas } from './topic-graph.ts';

export type LearningNode = {
  id: string; type: 'school' | 'lesson' | 'dialogue' | 'skill'; title: string;
  language: string; point: MapPoint; topicId?: string; school?: string; skillId?: string;
  versions?: { id: string; level?: Level }[];
};
export type LearningEdge = { id: string; from: string; to: string; automatic: boolean; manual: boolean; label?: string };
export type LearningGraph = { nodes: LearningNode[]; edges: LearningEdge[]; height: number };
export type LearningMapEntry = { kind: 'position'; nodeId: string; point: MapPoint } | { kind: 'edge'; from: string; to: string };
export type LearningMapOverlay = Record<string, LearningMapEntry | null>;
export type LearningProjection = LearningGraph & {
  page: number; pageSize: number; total: number; pages: number;
  counts: { visible: number; total: number; lessons: number; dialogues: number; schools: number; skills: number };
};
const identity = (...parts: string[]) => JSON.stringify(parts);
export const learningEdgeId = (from: string, to: string) => identity('edge', ...[from, to].sort());
const positionKey = (id: string) => identity('position', id);
const overlayFor = (study: Study): LearningMapOverlay =>
  (study.languages[study.language] as { learningMap?: LearningMapOverlay } | undefined)?.learningMap ?? {};
function overlayEntry(study: Study, key: string, entry: LearningMapEntry | null): Study {
  return { ...study, languages: { ...study.languages, [study.language]: {
    ...study.languages[study.language], learningMap: { ...overlayFor(study), [key]: entry }
  } } };
}
const finitePoint = (point: MapPoint | undefined | null): point is MapPoint => !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
function generatedPoint(id: string, anchor?: MapPoint): MapPoint {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return withinCanvas(anchor ? { x: anchor.x + (hash % 2 ? 18 : -18), y: anchor.y + ((hash >>> 4) % 17 - 8) }
    : { x: 22 + hash % 57, y: 8 + (hash >>> 8) % 85 });
}

/** Derive current-language content; never prune unresolved saved overlay entries. */
export function buildLearningGraph(study: Study, datedLessons: DatedLesson[], skills: Skill[]): LearningGraph {
  const topics = study.topics.filter(topic => topic.language === study.language);
  const positions = topicPositions(topics), overlay = overlayFor(study);
  const nodes: LearningNode[] = [], edges = new Map<string, LearningEdge>();
  function addNode(node: LearningNode) {
    const saved = overlay[positionKey(node.id)];
    if (node.type !== 'lesson' && saved?.kind === 'position' && saved.nodeId === node.id && finitePoint(saved.point)) node.point = withinCanvas(saved.point);
    nodes.push(node);
  }
  function addEdge(from: string, to: string, automatic: boolean, label?: string) {
    const id = learningEdgeId(from, to), previous = edges.get(id);
    edges.set(id, { id, from, to, automatic: automatic || !!previous?.automatic,
      manual: !automatic || !!previous?.manual, label: label ?? previous?.label });
  }
  const lessons = importedLessonsFor(study);
  for (const topic of topics) {
    const source = lessonSource(topic, datedLessons), savedPoint = positions.get(topic.id)!;
    const point = finitePoint(savedPoint) ? savedPoint : generatedPoint(topic.id);
    addNode({ id: topic.id, type: 'lesson', title: topic.title, language: topic.language, point, topicId: topic.id, school: source?.school });
    if (source?.school) {
      const id = identity('school', topic.language, source.school.normalize('NFC').trim().toLocaleLowerCase());
      if (!nodes.some(node => node.id === id)) addNode({ id, type: 'school', title: source.school, school: source.school,
        language: topic.language, point: generatedPoint(id) });
      addEdge(id, topic.id, true, 'Школа → урок');
    }
    for (const choice of dialogueChoices(lessons.filter(lesson => lesson.topicId === topic.id))) {
      const first = choice.versions[0];
      // dialogueChoices uses resource identity for unlevelled scenes and duplicate levels.
      const duplicate = choice.versions.length === 1 && choice.title === first.resource.title && !!first.level;
      const group = !first.level || duplicate ? identity('resource', first.id) : identity('title', first.title.toLocaleLowerCase());
      const id = identity('dialogue', topic.id, group);
      addNode({ id, type: 'dialogue', title: choice.title, language: topic.language, point: generatedPoint(id, point),
        topicId: topic.id, school: source?.school, versions: choice.versions.map(({ id, level }) => ({ id, level })) });
      addEdge(topic.id, id, true, 'Урок → сцена');
    }
  }
  if (study.language === 'en') for (const skill of skills) {
    const id = identity('skill', study.language, skill.id);
    addNode({ id, type: 'skill', skillId: skill.id, title: skill.title, language: study.language, point: generatedPoint(id) });
    for (const entry of skill.dialogues) {
      const matches = nodes.filter(node => node.type === 'dialogue' && node.school === entry.school && node.versions?.some(version => lessons.some(lesson => lesson.id === version.id && lesson.title === entry.title)));
      if (matches.length === 1) addEdge(id, matches[0].id, true, 'Навык → сцена');
    }
  }
  for (const edge of topicEdges(topics)) addEdge(edge.from, edge.to, false);
  const known = new Map(nodes.map(node => [node.id, node]));
  for (const [key, entry] of Object.entries(overlay)) {
    if (entry?.kind !== 'edge' || typeof entry.from !== 'string' || typeof entry.to !== 'string' || entry.from === entry.to || key !== learningEdgeId(entry.from, entry.to)) continue;
    const a = known.get(entry.from), b = known.get(entry.to);
    if (!a || !b || a.language !== b.language || a.type === 'lesson' && b.type === 'lesson') continue;
    addEdge(a.id, b.id, false);
  }
  return { nodes, edges: [...edges.values()], height: Math.max(3, Math.ceil(topics.length / 2)) * 112 };
}

/** Bounded read-only neighbourhood; coordinates always remain in the full graph frame. */
export function projectLearningGraph(graph: LearningGraph, focusId?: string, page = 0, pageSize = 12): LearningProjection {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.min(12, Math.floor(pageSize))) : 12;
  const focus = graph.nodes.find(node => node.id === focusId) ?? graph.nodes.find(node => node.type === 'lesson') ?? graph.nodes[0];
  const included = new Set<string>();
  const neighbours = (id: string) => graph.edges.flatMap(edge => edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []);
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const candidates = focus ? graph.nodes.filter(node => neighbours(focus.id).includes(node.id) &&
    (focus.type === 'school' ? node.type === 'lesson' : focus.type === 'skill' ? node.type === 'dialogue' : true)) : [];
  const bounded = focus?.type === 'school' || focus?.type === 'skill';
  const total = candidates.length, pages = Math.max(1, Math.ceil(total / size));
  const current = Number.isFinite(page) ? Math.max(0, Math.min(pages - 1, Math.floor(page))) : 0;
  if (focus) included.add(focus.id);
  for (const candidate of bounded ? candidates.slice(current * size, (current + 1) * size) : candidates) included.add(candidate.id);
  // Scene/lesson context and scene skills, without recursively expanding schools or skills.
  for (const id of [...included]) {
    const node = byId.get(id)!;
    if (node.type === 'dialogue') for (const next of neighbours(id)) {
      const adjacent = byId.get(next)!;
      if (adjacent.type === 'lesson' || adjacent.type === 'skill') included.add(next);
    }
  }
  for (const id of [...included]) if (byId.get(id)?.type === 'lesson') {
    for (const next of neighbours(id)) if (byId.get(next)?.type === 'school') included.add(next);
  }
  const nodes = graph.nodes.filter(node => included.has(node.id));
  return { nodes, edges: graph.edges.filter(edge => included.has(edge.from) && included.has(edge.to)), height: graph.height,
    page: current, pageSize: size, total, pages, counts: { visible: nodes.length, total: graph.nodes.length,
      lessons: graph.nodes.filter(node => node.type === 'lesson').length, dialogues: graph.nodes.filter(node => node.type === 'dialogue').length,
      schools: graph.nodes.filter(node => node.type === 'school').length, skills: graph.nodes.filter(node => node.type === 'skill').length } };
}

export function moveLearningNode(study: Study, graph: LearningGraph, id: string, point: MapPoint): Study {
  const node = graph.nodes.find(node => node.id === id);
  if (!node || node.language !== study.language || !finitePoint(point)) return study;
  return node.type === 'lesson' ? moveTopic(study, id, point)
    : overlayEntry(study, positionKey(id), { kind: 'position', nodeId: id, point: withinCanvas(point) });
}
export function connectLearningNodes(study: Study, graph: LearningGraph, from: string, to: string): Study {
  const a = graph.nodes.find(node => node.id === from), b = graph.nodes.find(node => node.id === to);
  const id = learningEdgeId(from, to);
  if (!a || !b || from === to || a.language !== b.language || a.language !== study.language || graph.edges.some(edge => edge.id === id)) return study;
  return a.type === 'lesson' && b.type === 'lesson' ? connectTopics(study, from, to)
    : overlayEntry(study, id, { kind: 'edge', from, to });
}
export function disconnectLearningNodes(study: Study, graph: LearningGraph, edgeId: string): Study {
  const edge = graph.edges.find(edge => edge.id === edgeId);
  if (!edge?.manual) return study;
  const a = graph.nodes.find(node => node.id === edge.from), b = graph.nodes.find(node => node.id === edge.to);
  if (!a || !b || a.language !== study.language || b.language !== study.language) return study;
  return a.type === 'lesson' && b.type === 'lesson' ? disconnectTopics(study, a.id, b.id) : overlayEntry(study, edgeId, null);
}
