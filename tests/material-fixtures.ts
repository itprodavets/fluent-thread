import { readFileSync } from 'node:fs';
const catalog: {id:string;path:string}[] = JSON.parse(readFileSync(new URL('../materials/en/lessons/catalog.json',import.meta.url),'utf8'));
export function lessonPath(slug:string) {
  const entry=catalog.find(lesson=>lesson.id===slug || lesson.id.endsWith('/'+slug));
  if(!entry) throw new Error('Unknown lesson: '+slug);
  return new URL('../materials/en/'+entry.path,import.meta.url);
}
export function readLesson(slug:string) { return JSON.parse(readFileSync(lessonPath(slug),'utf8')); }
