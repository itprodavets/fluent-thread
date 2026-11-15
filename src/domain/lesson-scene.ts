import type { Level } from './starter-materials';

export type Pair = [string, string];
export type LessonScene = {
  id: string;
  title: string;
  source: string;
  task: string;
  versions: Record<Level, Pair[]>;
  questions?: Pair[];
  notes?: Pair[];
};
