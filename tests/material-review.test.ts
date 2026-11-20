import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyStudy, packStudy, unpackStudy } from '../src/domain/profile-sync.ts';
import { assessMaterial, materialReviewStatus, assessPracticeItem, materialRecallContent } from '../src/domain/material-review.ts';
import { lessonReviewQueue } from '../src/domain/lesson-review.ts';
import type { Resource } from '../src/domain/model.ts';
const now = Date.parse('2026-11-20T05:00:00Z');
const card: Resource = { id:'dialogue-b2',language:'en',title:'Opinion · B2',kind:'dialogue',text:'Teacher: Why?\nLearner: Because…',prompt:'Give your opinion',answer:'',url:'',topicId:'lesson' };
const initial = () => ({...emptyStudy(),resources:[card,{...card,id:'dialogue-c1',title:'Opinion · C1'},{...card,id:'other-language',language:'es'}]});
test('materials are new until assessed; levels and languages have independent schedules', () => {
  const study=initial();
  assert.equal(materialReviewStatus(study.results[card.id],now).label,'Новое');
  const rated=assessMaterial(study,card,'independent',now);
  assert.equal(rated.results[card.id].schedules?.spoken?.due,now+86400000);
  assert.equal(rated.results['dialogue-c1'],undefined);
  assert.equal(lessonReviewQueue(rated,now).materials.length,0);
  assert.equal(lessonReviewQueue(rated,now+86400000).materials[0].resource.id,card.id);
  assert.equal(materialReviewStatus(rated.results[card.id],now).label,'Самостоятельно');
  assert.equal(assessMaterial(study,study.resources[2],'retry',now),study);
});
test('retry is due after ten minutes, hints after a day, and removed materials never return', () => {
  const study=assessMaterial(initial(),card,'retry',now);
  assert.equal(lessonReviewQueue(study,now+599999).materials.length,0);
  assert.equal(lessonReviewQueue(study,now+600000).materials.length,1);
  assert.equal(lessonReviewQueue({...study,resources:[]},now+600000).materials.length,0);
  const hint=assessMaterial(study,card,'assisted',now+600000);
  assert.equal(hint.results[card.id].due,now+600000+86400000);
  assert.equal(materialReviewStatus(hint.results[card.id],now).label,'С подсказкой');
  assert.deepEqual(unpackStudy(packStudy(hint)).results,hint.results,'resource results survive cloud serialization');
});

test('free practice uses the same material retry schedule while preserving written practice', () => {
  const study=initial();
  assert.equal(assessPracticeItem(study,card,'retry',now,'spoken').results[card.id].due,now+600000);
  assert.equal(assessPracticeItem(study,card,'retry',now,'written').results[card.id].due,now);
});

test('recall preserves exercise passage and a link-only material source', () => {
  const task=materialRecallContent({...card,kind:'exercise',text:'Read this passage.',prompt:'Answer the question.',answer:'Expected reply'});
  assert.equal(task.passage,'Read this passage.');
  assert.equal(task.reference,'Expected reply');
  assert.equal(materialRecallContent({...card,text:'',url:'https://example.com/source'}).url,'https://example.com/source');
});
