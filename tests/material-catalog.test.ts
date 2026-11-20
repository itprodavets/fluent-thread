import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChatPackage } from '../src/domain/chat-package.js';
import { dialogueVersion } from '../src/domain/imported-lessons.ts';
import { teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import { lessonCues } from '../src/domain/lesson-cues.ts';
const root=fileURLToPath(new URL('../materials/',import.meta.url));
const read=(path:string)=>JSON.parse(readFileSync(resolve(root,path),'utf8'));

test('language catalogs resolve every complete lesson and resource without date-rooted folders',()=>{
  const ids=new Set();
  assert.ok(!readdirSync(root).some(name=>/^\d{4}-\d{2}-\d{2}$/.test(name)));
  for(const language of read('catalog.json').languages){
    for(const item of [...read(language.lessons),...read(language.resources)]){
      assert.equal(item.language,language.code);assert.ok(!ids.has(language.code+':'+item.id));ids.add(language.code+':'+item.id);
      const path=resolve(root,language.code,item.path);
      assert.ok(path.startsWith(resolve(root,language.code)+'/'));
      const packet=parseChatPackage(readFileSync(path,'utf8'));
      assert.equal(packet.language,language.code);
      assert.equal(packet.topic.title,item.topic ?? item.title);
      assert.ok(existsSync(resolve(dirname(path),'README.md')));
      if(item.date) assert.equal(packet.topic.source?.date,item.date);
    }
    assert.ok(existsSync(resolve(root,language.skills)));assert.ok(existsSync(resolve(root,language.schools)));
  }
  assert.ok(ids.size>=16);
});

test('published Markdown links resolve after school/topic relocation',()=>{
  function walk(path:string):string[]{return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(path,entry.name)):[resolve(path,entry.name)]);}
  for(const path of walk(root).filter(p=>extname(p)==='.md')){
    const text=readFileSync(path,'utf8');
    for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
      const link=match[1];if(/^[a-z]+:|^#/i.test(link))continue;
      assert.ok(existsSync(resolve(dirname(path),decodeURIComponent(link.split('#')[0]))),`${path}: ${link}`);
    }
  }
});

test('new lesson retains complete source coverage, six levels and immediately usable phrase practice',()=>{
  const folder='en/lessons/teaching-house/nature-and-nurture/';
  const source=read(folder+'source-transcript.json'), transcript=read(folder+'transcript.json');
  assert.equal(source.segments.length,674);assert.equal(source.durationSeconds,2873.46);
  assert.deepEqual(transcript.flatMap((row:any)=>Array.from({length:row.sourceEnd-row.sourceStart},(_,i)=>row.sourceStart+i)),source.segments.map((row:any)=>row.index));
  assert.equal(transcript.at(-1).end,source.durationSeconds);
  assert.ok(transcript.every((row:any)=>row.en && row.ru && row.end>row.start));
  const packet=parseChatPackage(readFileSync(resolve(root,folder,'lesson.json'),'utf8'));
  const groups=new Map<string,string[]>();
  for(const item of packet.materials.filter((row:any)=>row.kind==='dialogue')){
    const {title,level}=dialogueVersion(item.title);const levels=groups.get(title)??[];levels.push(level!);groups.set(title,levels);
    assert.ok(item.text.includes('Learner:'));assert.ok(item.translation);
    assert.ok(packet.materials.some((row:any)=>row.title==='Чтение и ответ · '+item.title && row.prompt.includes(item.text) && row.answer));
  }
  assert.equal(groups.size,3);
  for(const levels of groups.values())assert.deepEqual(levels,['A1','A2','B1','B2','C1','C2']);
  assert.equal(teacherPhraseCards(packet.materials.find((row:any)=>row.title.startsWith('Реплики преподавателя ·'))!.text).length,23);
  const cues=lessonCues(packet.materials.find((row:any)=>row.title==='Запись урока с таймкодами')!.text);
  assert.equal(cues.length,transcript.length);
  assert.ok(packet.words.length>=70);
  assert.ok(!/\bDen(?:n)?is\b|Денис|Деннис/iu.test(JSON.stringify(packet)));
});
