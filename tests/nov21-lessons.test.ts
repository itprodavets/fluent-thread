import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseChatPackage, applyChatPackage } from '../src/domain/chat-package.js';
import { dialogueVersion } from '../src/domain/imported-lessons.ts';
import { lessonCues } from '../src/domain/lesson-cues.ts';
import { teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import { addLessonMistakes, availableLessonMistakes } from '../src/domain/lesson-mistakes.ts';
import { lessonReviewQueue } from '../src/domain/lesson-review.ts';
import { emptyStudy, packStudy, unpackStudy } from '../src/domain/profile-sync.ts';
const cases=[
 {id:'ih-bangkok/technology-breaks-and-celebration-plans',key:'lesson-2026-11-21-ih-bangkok',count:1526,duration:5829.56,last:5824.88},
 {id:'ace-tefl/reports-and-mirror-town',key:'lesson-2026-11-21-ace-reports-mirrors',count:1698,duration:6499.8,last:6491.24}
];
const folder=(id:string)=>new URL('../materials/en/lessons/'+id+'/',import.meta.url);
const text=(id:string,name:string)=>readFileSync(new URL(name,folder(id)),'utf8');
const read=(id:string,name:string)=>JSON.parse(text(id,name));

test('November21 lessons cover all 3224 recognized segments with aligned bilingual blocks and six-level practice',()=>{
 for(const item of cases){
  const source=read(item.id,'source-transcript.json'),transcript=read(item.id,'transcript.json');
  assert.equal(source.segments.length,item.count);assert.equal(source.durationSeconds,item.duration);assert.equal(source.segments.at(-1).end,item.last);
  assert.deepEqual(transcript.flatMap((line:any)=>Array.from({length:line.sourceEnd-line.sourceStart},(_,i)=>line.sourceStart+i)),source.segments.map((line:any)=>line.index));
  assert.equal(transcript.at(-1).end,item.duration);
  for(const line of transcript){assert.equal(line.en,source.segments.slice(line.sourceStart,line.sourceEnd).map((segment:any)=>segment.text).join(' '));assert.ok(line.ru.length>40&&line.heading&&line.end>line.start);}
  const packet=parseChatPackage(text(item.id,'lesson.json'));
  assert.equal(packet.topic.source?.date,'2026-11-21');assert.ok(packet.words.length>=70&&packet.words.every((word:any)=>word.vocabularyLevel==='learning'));
  const scenes=new Map<string,string[]>();
  for(const material of packet.materials.filter((row:any)=>row.kind==='dialogue')){
   const {title,level}=dialogueVersion(material.title);const levels=scenes.get(title)??[];levels.push(level!);scenes.set(title,levels);
   assert.ok(material.translation&&material.text.includes('Learner:'));
   assert.ok(packet.materials.some((row:any)=>row.title==='Чтение и ответ · '+material.title&&row.prompt.includes(material.text)&&row.answer));
  }
  assert.ok(scenes.size>=3);for(const levels of scenes.values())assert.deepEqual(levels,['A1','A2','B1','B2','C1','C2']);
  for(const level of ['A1','A2','B1','B2','C1','C2'])assert.ok(packet.materials.some((row:any)=>row.kind==='reading'&&row.title.endsWith(' · '+level)&&row.translation));
  assert.ok(teacherPhraseCards(packet.materials.find((row:any)=>row.title.startsWith('Реплики преподавателя ·'))!.text).length>=20);
  assert.ok(packet.materials.some((row:any)=>row.title.startsWith('Грамматика урока ·')));
  assert.ok(packet.materials.some((row:any)=>row.title==='Разбор записи · реплики ученика и естественные ответы'));
  const timed=packet.materials.find((row:any)=>row.title==='Запись урока с таймкодами')!;
  assert.ok(timed.text.startsWith('Recording: '+item.key));assert.equal(lessonCues(timed.text).length,transcript.length);
  const pack=read(item.id,'mistake-practice.json');assert.equal(pack.id,item.id);assert.equal(pack.recordingKey,item.key);assert.ok(pack.cards.length>=5);
  for(const name of readdirSync(folder(item.id))){
   assert.ok(!/\.(wav|mp3|m4a|mp4|webm|py)$/i.test(name));
   const content=text(item.id,name);assert.ok(!/\bDen(?:n)?is(?:e)?\b|Денис|Деннис|\/Users\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|zoom\.us\/j\//iu.test(content),item.id+'/'+name);
  }
 }
});

test('new lesson mistakes extend the existing queue without resetting older personal practice',()=>{
 let study=emptyStudy();
 for(const item of cases)study=applyChatPackage(study,parseChatPackage(text(item.id,'lesson.json'))).next;
 const packs=cases.map(item=>read(item.id,'mistake-practice.json'));const count=packs.reduce((sum,pack)=>sum+pack.cards.length,0);
 const correction={rule:'agree-verb',before:'I am agree',after:'I agree',reason:'Agree is a verb.'};
 const older={id:'older',scenario:{skillId:'disagreeing',school:'Earlier lesson',title:'Earlier personal situation',prompt:'Agree politely.',answer:'I agree.',role:{line:'Do you agree?',patterns:['I agree']},phrases:[]},correction,corrections:[correction],original:'I am agree',due:1800086400000,level:2,last:{answer:'I agree with that point.',result:'fixed' as const}};
 study={...study,dialogueMistakes:{older}};
 assert.equal(availableLessonMistakes(study,packs).length,count);
 const seeded=addLessonMistakes(study,packs,1800000000000);
 assert.equal(lessonReviewQueue(seeded,1800000000000).mistakes.length,count);
 assert.equal(seeded.dialogueMistakes!.older,older);
 assert.equal(seeded.results,study.results);
 assert.ok(Object.values(seeded.dialogueMistakes!).filter(card=>card.id!=='older').every(card=>card.source?.date==='2026-11-21'));
 assert.equal(addLessonMistakes(seeded,packs,1800000000001),seeded);
 assert.deepEqual(unpackStudy(packStudy(seeded)),seeded);
});

test('ACE homework keeps the supplied four headings and distinguishes a model from source words',()=>{
 const lesson=read(cases[1].id,'lesson.json');const all=JSON.stringify(lesson);
 for(const heading of ['Why the report has been written','Benefits of the proposed scheme','Drawbacks of the proposed scheme','Recommendations'])assert.ok(all.includes(heading));
 assert.match(all,/food court/i);
});
