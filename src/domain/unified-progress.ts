import type { Outcome, PracticeMode, PracticeResult, Study } from './model';
import type { DialogueMistake } from './dialogue-mistakes';
import { reviewResources } from './material-review.ts';
import { phraseVocabularyId, phraseWordKey, teacherPhraseCards } from './lesson-practice.ts';
import type { PhraseCard } from './lesson-practice';

export type ProgressStatus = 'new' | 'learning' | 'independent';
export type ProgressCategoryId = 'words' | 'phrases' | 'dialogues' | 'exercises' | 'materials' | 'mistakes';
export type ProgressRow = {
  id: string; title: string; status: ProgressStatus; due: boolean;
  mode?: PracticeMode; outcome?: Outcome; updated?: number;
  target: 'practice' | 'mistake' | 'review'; mistake?: DialogueMistake;
};
export type ProgressCategory = {
  id: ProgressCategoryId; title: string; rows: ProgressRow[];
  total: number; new: number; learning: number; independent: number; due: number;
  completedPractice: number; assisted: number; retry: number;
};

/** Read only: the latest productive assessment, never a choice-only success. */
function assessed(result?: PracticeResult): Pick<ProgressRow, 'status' | 'mode' | 'outcome' | 'updated'> {
  if (!result) return { status: 'new' };
  const candidates: { mode: PracticeMode; outcome?: Outcome; updated: number }[] = [];
  const mode=result.mode ?? 'spoken';
  if (mode !== 'choice') candidates.push({ mode, outcome: result.result, updated: result.updated });
  if (result.spokenResult) candidates.push({ mode:'spoken',outcome:result.spokenResult,updated:result.spokenUpdated ?? (mode==='spoken'?result.updated:0) });
  for (const entry of ['spoken','written'] as const) {
    const schedule=result.schedules?.[entry];
    if (schedule && !candidates.some(c=>c.mode===entry && c.updated>=(schedule.updated ?? 0)))
      candidates.push({mode:entry,outcome:schedule.level>0?'independent':undefined,updated:schedule.updated ?? 0});
  }
  // Undated legacy modes establish a result only when their evidence agrees.
  if (mode==='choice' && candidates.some(c=>c.updated===0) && candidates.some(c=>c.outcome!=='independent'))
    return {status:'learning'};
  const latest=candidates.sort((a,b)=>b.updated-a.updated)[0];
  if (!latest) return {status:'learning',mode:'choice',outcome:result.result,updated:result.updated};
  return {status:latest.outcome==='independent'?'independent':'learning',...latest};
}
function row(id:string,title:string,results:Study['results'],now:number):ProgressRow {
  const result=results[id];
  return {id,title,...assessed(result),due:!!result && Number.isFinite(result.due) && result.due<=now,target:'practice'};
}

/** Each invocation receives exactly one profile; no cache or cross-profile/global counters. */
export function unifiedProgress(study:Study,now:number,knownPhrases:PhraseCard[]=[]):ProgressCategory[] {
  const vocabulary=study.words.filter(w=>w.language===study.language);
  const resources=study.resources.filter(r=>r.language===study.language);
  const phraseKeys=new Set(knownPhrases.map(card=>phraseVocabularyId(card,study.language)));
  for(const source of resources) {
    if(source.kind==='reading' && /^(Реплики преподавателя|Полезные фразы) ·/u.test(source.title))
      for(const card of teacherPhraseCards(source.text))phraseKeys.add(phraseVocabularyId(card,study.language));
  }
  const words=vocabulary.map(w=>row(w.id,w.title,study.results,now));
  const wordRows=new Map(words.map(w=>[w.id,w]));
  const phrases=vocabulary.filter(w=>w.audioSource || phraseKeys.has(phraseWordKey(w))).map(w=>wordRows.get(w.id)!);
  const ownedIds=new Set(resources.map(r=>r.id));
  const materials=reviewResources(study).filter(r=>ownedIds.has(r.id) || study.results[r.id]);
  const resourceRows=(kind:'dialogue'|'exercise'|'other')=>materials.filter(r=>kind==='other'? !['dialogue','exercise'].includes(r.kind):r.kind===kind)
    .map(r=>({...row(r.id,r.title,study.results,now),target:ownedIds.has(r.id)?'practice' as const:'review' as const}));
  const other=[...resourceRows('other'),...study.topics.filter(t=>t.language===study.language && study.results[t.id]).map(t=>row(t.id,t.title,study.results,now))];
  const mistakes:ProgressRow[]=study.language==='en'?Object.values(study.dialogueMistakes ?? {}).map(card=>{
    const fixed=card.level>0 && card.last?.result==='fixed';
    const outcome:Outcome|undefined=fixed?(card.last?.assessment ?? 'independent'):card.last?'retry':undefined;
    return {id:card.id,title:card.scenario.title,status:outcome==='independent'?'independent':outcome?'learning':'new',outcome,
      due:Number.isFinite(card.due)&&card.due<=now,target:'mistake',mistake:card};
  }):[];
  const ownDialogues=new Set(resources.filter(r=>r.kind==='dialogue' && r.id.startsWith('dialogue:')).map(r=>r.id));
  for(const session of Object.values(study.dialogueSessions ?? {}))if(session.language===study.language && session.completedAt!==undefined)ownDialogues.add('dialogue:'+session.id);
  const ownStories=new Set(resources.filter(r=>r.story && r.id.startsWith('story:')).map(r=>r.id));
  for(const session of Object.values(study.storySessions ?? {}))if(session.language===study.language && session.completedAt!==undefined)ownStories.add('story:'+session.id);
  const groups:[ProgressCategoryId,string,ProgressRow[],number][]=[
    ['words','Слова и выражения',words,0],['phrases','Фразы из уроков и навыков',phrases,0],
    ['dialogues','Диалоги',resourceRows('dialogue'),ownDialogues.size],['exercises','Упражнения',resourceRows('exercise'),0],
    ['materials','Тексты и другая практика',other,ownStories.size],['mistakes','Исправление ошибок',mistakes,0]
  ];
  return groups.map(([id,title,rows,completedPractice])=>{
    const counts={new:0,learning:0,independent:0,due:0,assisted:0,retry:0};
    for(const item of rows){counts[item.status]++;if(item.due)counts.due++;if(item.outcome==='assisted')counts.assisted++;if(item.outcome==='retry')counts.retry++;}
    return {id,title,rows,total:rows.length,...counts,completedPractice};
  });
}

export type ProgressFilter=ProgressStatus|'all'|'due'|'assisted'|'retry';
/** Bounded rendered page shared by every category; counters still use the full set. */
export function progressRowsPage(rows:ProgressRow[],filter:ProgressFilter,page:number,size=30) {
  const filtered=rows.filter(row=>filter==='all'||(filter==='due'?row.due:filter==='assisted'||filter==='retry'?row.outcome===filter:row.status===filter));
  const pageSize=Math.max(1,Math.floor(size));
  const maxPage=Math.max(0,Math.ceil(filtered.length/pageSize)-1);
  const current=Math.max(0,Math.min(Number.isFinite(page)?Math.floor(page):0,maxPage));
  return {rows:filtered.slice(current*pageSize,(current+1)*pageSize),total:filtered.length,page:current,maxPage};
}
