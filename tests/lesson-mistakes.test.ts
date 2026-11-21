import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addLessonMistakes, availableLessonMistakes, assessLessonMistake } from '../src/domain/lesson-mistakes.ts';
import type { LessonMistakePack } from '../src/domain/lesson-mistakes.ts';
import { lessonReviewQueue } from '../src/domain/lesson-review.ts';
import { emptyStudy, packStudy, unpackStudy } from '../src/domain/profile-sync.ts';
import { mistakeReviewMoved } from '../src/domain/dialogue-mistakes.ts';
const packs: LessonMistakePack[] = ['dc-teacher-training/crime-punishment-and-time','ace-tefl/clarifying-meaning'].map(id=>JSON.parse(readFileSync(new URL('../materials/en/lessons/'+id+'/mistake-practice.json',import.meta.url),'utf8')));
const now=1_800_000_000_000;
function withLessons(){return {...emptyStudy(),topics:packs.map((pack,i)=>({id:'topic'+i,language:'en',title:'Renamed lesson '+i,links:[],prompt:''})),resources:packs.map((pack,i)=>({id:'transcript'+i,language:'en',topicId:'topic'+i,title:'Запись урока с таймкодами',kind:'reading' as const,text:'Recording: '+pack.recordingKey+'\n',prompt:'',answer:'',url:''}))};}
test('only explicitly added examples from imported English recordings become personal due mistakes',()=>{
 const initial=withLessons();
 assert.equal(availableLessonMistakes(emptyStudy(),packs).length,0);
 assert.equal(availableLessonMistakes({...initial,language:'es'},packs).length,0);
 assert.equal(availableLessonMistakes(initial,packs).length,29);
 assert.equal(initial.dialogueMistakes,undefined);
 const seeded=addLessonMistakes(initial,packs,now);
 assert.equal(Object.keys(seeded.dialogueMistakes!).length,29);
 assert.equal(seeded.results,initial.results);
 assert.equal(lessonReviewQueue(seeded,now).all.filter(item=>item.kind==='mistake').length,29);
 assert.ok(Object.values(seeded.dialogueMistakes!).every(card=>card.due===now&&card.level===0&&!card.last&&card.source?.topicId&&card.source.date==='2026-11-20'&&card.checklist?.length));
 assert.equal(addLessonMistakes(seeded,packs,now+500),seeded);
});
test('free answers persist with explicit self assessment; import and cloud round trips never reset them',()=>{
 let study=addLessonMistakes(withLessons(),packs,now);
 const id=Object.keys(study.dialogueMistakes!)[0];
 assert.equal(assessLessonMistake(study,id,'  ','independent',now),study);
 study=assessLessonMistake(study,id,'Evicted is a past participle; be evicted is passive.','independent',now);
 const card=study.dialogueMistakes![id];
 assert.equal(card.last?.assessment,'independent');assert.equal(card.last?.result,'fixed');assert.equal(card.level,1);assert.equal(card.due,now+86_400_000);
 assert.equal(assessLessonMistake(study,id,'Another correct response','independent',now+1000),study);
 assert.equal(addLessonMistakes(study,packs,now+1000),study);
 assert.deepEqual(unpackStudy(packStudy(study)),study);
 const twice=assessLessonMistake(study,id,'The word expelled is a past participle.','independent',card.due);
 assert.equal(twice.dialogueMistakes![id].level,2);assert.equal(twice.dialogueMistakes![id].due,card.due+3*86_400_000);
 const assisted=assessLessonMistake(twice,id,'I needed the hint.','assisted',twice.dialogueMistakes![id].due);
 assert.equal(assisted.dialogueMistakes![id].due,twice.dialogueMistakes![id].due+86_400_000);
 const retry=assessLessonMistake(assisted,id,'Still confusing the two labels.','retry',assisted.dialogueMistakes![id].due);
 assert.equal(retry.dialogueMistakes![id].level,0);assert.equal(retry.dialogueMistakes![id].last?.result,'retry');assert.equal(retry.dialogueMistakes![id].due,assisted.dialogueMistakes![id].due+600000);
});
test('unified queue keeps future mistake timers and language boundaries alongside words and materials',()=>{
 const seeded=addLessonMistakes(withLessons(),packs,now);const first=Object.values(seeded.dialogueMistakes!)[0];
 const study={...emptyStudy(),dialogueMistakes:{[first.id]:{...first,due:now+500}}};
 assert.equal(lessonReviewQueue(study,now).all.length,0);assert.equal(lessonReviewQueue(study,now).nextAt,now+500);
 assert.equal(lessonReviewQueue(study,now+500).all[0].kind,'mistake');
 assert.equal(lessonReviewQueue({...study,language:'es'},now+500).all.length,0);
});
test('published examples have traceable context, models and checklists without naming the learner',()=>{
 for(const pack of packs){
  assert.equal(new Set(pack.cards.map(card=>card.id)).size,pack.cards.length);
  assert.ok(!/Den(?:n)?is|Денис|\/Users\/|zoom\.us\/j\//iu.test(JSON.stringify(pack)));
  for(const card of pack.cards){assert.ok(card.time&&card.partner&&card.prompt&&card.original&&card.corrected&&card.reason);assert.ok(card.checklist.length>=2);}
 }
});

test('a held queue card can advance after another device rates or removes it',()=>{
 const seeded=addLessonMistakes(withLessons(),packs,now);
 const id=Object.keys(seeded.dialogueMistakes!)[0];
 assert.equal(mistakeReviewMoved(seeded,id,now),false);
 const remote=assessLessonMistake(seeded,id,'It is a past participle.','independent',now);
 const pulled=unpackStudy(packStudy(remote));
 assert.equal(mistakeReviewMoved(pulled,id,now),true);
 assert.equal(lessonReviewQueue(pulled,now).mistakes.some(item=>item.mistake.id===id),false);
 const deleted={...pulled,dialogueMistakes:{...pulled.dialogueMistakes}};
 delete deleted.dialogueMistakes[id];
 assert.equal(mistakeReviewMoved(deleted,id,now),true);
});
