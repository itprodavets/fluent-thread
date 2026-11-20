import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neutralLessonText, neutralLessonRoles } from '../src/domain/material-roles.ts';
import { emptyStudy, packStudy, reconcileRows } from '../src/domain/profile-sync.ts';
import { topicImportPreview } from '../src/domain/chat-package.js';

test('learner roles replace names and direct address without damaging other words',()=>{
  assert.equal(neutralLessonText('Teacher: Denis, what do you think?\nDenis: I agree.'),'Teacher: What do you think?\nLearner: I agree.');
  assert.equal(neutralLessonText('Where is Denis from? Denis’s answer is short.'),'Where is the learner from? The learner’s answer is short.');
  assert.equal(neutralLessonText('Вопрос Дениса. Денис отвечает. Ответ не приписывается Денису.'),'Вопрос ученика. Ученик отвечает. Ответ не приписывается ученику.');
  assert.equal(neutralLessonText('Dennis: Hello.\nДенис: Привет.'),'Learner: Hello.\nУченик: Привет.');
  assert.equal(neutralLessonText('Denise: Hello.'),'Learner: Hello.');
  assert.equal(neutralLessonText('Denison and denis@example.com are literal identifiers.'),'Denison and denis@example.com are literal identifiers.');
});

test('stored lesson migration preserves IDs, progress, profile name and edited import boundaries',()=>{
  const original={id:'r',topicId:'t',language:'en',kind:'dialogue' as const,title:'Practice',text:'Denis: Hello.',prompt:'',answer:'',url:''};
  const content=JSON.stringify([original.kind,original.title,original.text,original.prompt,original.answer,original.url,'']);
  const study={...emptyStudy(),profileName:'Denis Kharchenko',resources:[original],
    topicPackageMaterials:{t:[{id:'r',content}]},results:{word:{due:123} as any},
    words:[{id:'word',language:'en',title:'name',meaning:'имя',example:'My name is Denis.',ownExamples:['I am Denis.']}]};
  const result=neutralLessonRoles(study);
  assert.equal(result.resources[0].id,'r');assert.equal(result.resources[0].text,'Learner: Hello.');
  assert.equal(result.profileName,study.profileName);assert.equal(result.words,study.words);assert.equal(result.results,study.results);
  assert.equal(topicImportPreview(result,'t')[0].selected,true);
  assert.equal(neutralLessonRoles(result),result,'migration is idempotent and keeps clean identities');
  const edited={...study,topicPackageMaterials:{t:[{id:'r',content:content+' stale'}]}};
  assert.equal(topicImportPreview(neutralLessonRoles(edited),'t')[0].selected,false,'migration must not approve a user-edited resource');
});

test('cloud resource replay cannot reintroduce learner name or change progress IDs',()=>{
  const study=emptyStudy(), resource={id:'r',language:'en',kind:'dialogue',title:'Test',text:'Denis: Yes.',prompt:'',answer:'',url:''};
  const packed=packStudy({...study,resources:[resource] as any});
  const doc=reconcileRows({study,base:{},cursor:0,conflicts:[]},Object.entries(packed).map(([id,value],i)=>({id,value,revision:i+1})));
  assert.equal(doc.study.resources[0].text,'Learner: Yes.');assert.equal(doc.study.resources[0].id,'r');
});

test('managed snapshots arriving on a later cloud page keep replacement eligibility',()=>{
  const study=emptyStudy();
  const resource={id:'r',topicId:'t',language:'en',kind:'dialogue',title:'Test',text:'Denis: Hello.',prompt:'',answer:'',url:''};
  const snapshot=JSON.stringify([resource.kind,resource.title,resource.text,'','','','']);
  const first=reconcileRows({study,base:{},cursor:0,conflicts:[]},[
    {id:JSON.stringify(['resources','r']),value:resource,revision:1}
  ]);
  const second=reconcileRows(first,[
    {id:JSON.stringify(['topicPackageMaterials','t']),value:[{id:'r',content:snapshot}],revision:2}
  ]);
  assert.equal(topicImportPreview(second.study,'t')[0].selected,true);
  assert.equal(neutralLessonRoles(second.study),second.study);
});
