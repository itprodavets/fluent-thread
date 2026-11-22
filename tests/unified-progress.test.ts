import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unifiedProgress, progressRowsPage } from '../src/domain/unified-progress.ts';
import { starterLessons } from '../src/domain/starter-materials.ts';
import { emptyStudy, packStudy, unpackStudy } from '../src/domain/profile-sync.ts';
import { assess } from '../src/domain/model.ts';
import type { Resource, Study, Word } from '../src/domain/model';
const now=1800000000000;
const word=(id:string,title=id,meaning='перевод'):Word=>({id,title,meaning,language:'en',example:''});
const resource=(id:string,kind:Resource['kind']):Resource=>({id,kind,language:'en',title:id,text:'Text',prompt:'Question',answer:'Answer',url:''});
const category=(study:Study,id:string)=>unifiedProgress(study,now).find(c=>c.id===id)!;
const mistake=(id:string,level=0,last?:any)=>({id,level,due:now,original:'I am agree',correction:{rule:'agree',before:'I am agree',after:'I agree',reason:'Agree is a verb.'},corrections:[],scenario:{skillId:'agree',school:'School',title:id,prompt:'Agree',answer:'I agree',role:{line:'Do you agree?',patterns:[]},phrases:[]},last});

test('all sections derive counts without changing answers, schedules or profile data',()=>{
 let study:Study={...emptyStudy(),words:[word('w'),word('p','Please go ahead')],resources:[resource('d','dialogue'),resource('e','exercise'),resource('r','reading')],dialogueMistakes:{new:mistake('new'),fixed:mistake('fixed',2,{answer:'I agree with you',result:'fixed'}),helped:mistake('helped',1,{answer:'I agree',result:'fixed',assessment:'assisted'}),again:mistake('again',0,{answer:'I agree',result:'fixed'})}};
 for(const id of ['w','p','d','e','r'])study=assess(study,id,id==='e'?'assisted':'independent',now-86400000,'written');
 const snapshot=JSON.stringify(study);const all=unifiedProgress(study,now,[{phrase:'Please go ahead',meaning:'перевод',pattern:'',example:''}]);
 assert.equal(all.find(c=>c.id==='words')!.independent,2);
 assert.equal(all.find(c=>c.id==='phrases')!.independent,1);
 assert.equal(all.find(c=>c.id==='dialogues')!.independent,1);
 assert.equal(all.find(c=>c.id==='exercises')!.learning,1);
 assert.equal(all.find(c=>c.id==='materials')!.independent,1);
 const errors=all.find(c=>c.id==='mistakes')!;
 assert.deepEqual([errors.total,errors.independent,errors.learning,errors.new],[4,1,2,1]);
 assert.equal(errors.rows.find(r=>r.id==='fixed')!.mistake!.last!.answer,'I agree with you');
 assert.equal(all.find(c=>c.id==='words')!.due,2);
 for(const c of all){assert.equal(c.total,c.rows.length);assert.equal(c.new+c.learning+c.independent,c.total);}
 assert.equal(JSON.stringify(study),snapshot);
 assert.deepEqual(unifiedProgress(unpackStudy(packStudy(study)),now),unifiedProgress(study,now));
});

test('choice alone, active vocabulary and imported Anki reviews do not claim productive mastery; retry replaces success',()=>{
 let study={...emptyStudy(),words:[{...word('w'),vocabularyLevel:'active' as const,ankiReviews:100}]};
 assert.equal(category(study,'words').new,1);
 study=assess(study,'w','independent',now,'choice');
 assert.equal(category(study,'words').learning,1);assert.equal(category(study,'words').independent,0);
 study=assess(study,'w','independent',now+1,'spoken');
 study=assess(study,'w','retry',now+2,'choice');
 assert.equal(category(study,'words').independent,1);
 study=assess(study,'w','retry',now+3,'spoken');
 assert.equal(category(study,'words').independent,0);
 assert.equal(category(study,'words').learning,1);
});

test('profiles, languages and archived items stay separate; assessed starters survive',()=>{
 const a={...emptyStudy(),words:[word('a'),{...word('foreign'),language:'es'}],resources:[resource('active','exercise'),{...resource('foreign-d','dialogue'),language:'es'}]};
 const b=assess({...emptyStudy(),words:[word('a')]},'a','independent',now,'written');
 assert.equal(category(a,'words').total,1);assert.equal(category(a,'words').independent,0);
 assert.equal(category(b,'words').independent,1);assert.equal(category(emptyStudy(),'words').total,0);
 const archived=assess({...a,resources:[]},'active','independent',now,'spoken');
 assert.equal(category(archived,'exercises').total,0);
});

test('phrase identity follows catalog and saved-source metadata rather than spaces; unattempted phrases remain new',()=>{
 const phrase={phrase:'Could you help?',meaning:'Поможешь?',pattern:'',example:''};
 const study={...emptyStudy(),words:[word('p','Could you help','Поможешь'),word('multi','Hong Kong'),{...word('source','请稍等'),audioSource:{recordingKey:'r',start:0,end:1,en:'请稍等',ru:'Подожди'}}]};
 const phrases=unifiedProgress(study,now,[phrase]).find(c=>c.id==='phrases')!;
 assert.equal(phrases.total,2);assert.equal(phrases.new,2);assert.equal(category(study,'words').total,3);
});

test('own completed dialogues are practice, not mastered models; levels remain distinct and large dictionaries are linear',()=>{
 const study:Study={...emptyStudy(),words:Array.from({length:45000},(_,i)=>word(String(i))),resources:[resource('B1','dialogue'),resource('B2','dialogue'),resource('dialogue:own','dialogue')],dialogueSessions:{en:{id:'own',language:'en',topicId:'t',title:'My talk',prompt:'',wordIds:[],startedAt:now-2,completedAt:now-1,draft:{lines:['Hi','Hello'],mode:'written',performed:false,hint:false},outcomes:{}}}};
 const result=unifiedProgress(study,now);const dialogues=result.find(c=>c.id==='dialogues')!;
 assert.equal(dialogues.total,3);assert.equal(dialogues.independent,0);assert.equal(dialogues.completedPractice,1);
 assert.equal(result.find(c=>c.id==='words')!.total,45000);
});

test('assessed starter material has a working review destination and unassessed starters are not imported into totals',()=>{
 const starter=starterLessons[0].resource;
 const study=assess(emptyStudy(),starter.id,'independent',now-86400000,'spoken');
 const all=unifiedProgress(study,now);
 const rows=all.flatMap(category=>category.rows);
 assert.equal(rows.length,1);assert.equal(rows[0].id,starter.id);assert.equal(rows[0].target,'review');
 assert.equal(rows[0].status,'independent');assert.equal(rows[0].due,true);
});

test('assisted corrections and recurring errors have distinct counters and bounded filtered pages',()=>{
 const study={...emptyStudy(),dialogueMistakes:{helped:mistake('helped',1,{answer:'I agree',result:'fixed',assessment:'assisted'}),retry:mistake('retry',0,{answer:'I am agree',result:'retry'})}};
 const errors=category(study,'mistakes');
 assert.equal(errors.assisted,1);assert.equal(errors.retry,1);
 assert.deepEqual(progressRowsPage(errors.rows,'assisted',0).rows.map(row=>row.id),['helped']);
 assert.deepEqual(progressRowsPage(errors.rows,'retry',0).rows.map(row=>row.id),['retry']);
 const large:Study={...emptyStudy(),words:Array.from({length:45000},(_,i)=>word(String(i)))};
 large.results=Object.fromEntries(large.words.map((w,i)=>[w.id,{level:1,result:'independent' as const,due:now+1,updated:now+i,attempts:1,mode:'written' as const}]));
 const words=category(large,'words');assert.equal(words.independent,45000);
 const page=progressRowsPage(words.rows,'independent',1);assert.equal(page.total,45000);assert.equal(page.rows.length,30);assert.equal(page.rows[0].id,'30');
 assert.equal(progressRowsPage(words.rows,'new',50).page,0);
});

test('legacy undated productive schedules preserve proven independence without inventing chronology',()=>{
 const study:Study={...emptyStudy(),words:[word('w')],results:{w:{level:1,result:'independent',due:now+1,attempts:3,updated:now,mode:'choice',schedules:{written:{level:2,due:now+1}}}}};
 assert.equal(category(study,'words').independent,1);
 study.results.w.schedules!.spoken={level:0,due:now+1};
 assert.equal(category(study,'words').independent,0);
 assert.equal(category(study,'words').learning,1);
});
