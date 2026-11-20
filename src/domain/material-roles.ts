import type { Resource, Study } from './model';

/** Educational roles only: real profile names, word IDs and learner-authored examples are untouched. */
export function neutralLessonText(text: string): string {
  if (!/Den(?:n)?is(?:e)?|Д[еэ]н(?:н)?ис/iu.test(text)) return text;
  const literals: string[] = [];
  const protectedText = text.replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,
    value => `\uE000${literals.push(value)-1}\uE001`);
  const result = protectedText
    .replace(/(^|\n)(\s*(?:-\s*)?)Den(?:n)?is(?:e)?\s*:/gi, '$1$2Learner:')
    .replace(/(^|\n)(\s*(?:-\s*)?)Д[еэ]н(?:н)?ис\s*:/gi, '$1$2Ученик:')
    .replace(/(^|\n|[.!?]\s+|:\s*)Den(?:n)?is(?:e)?,\s*(\p{L})/giu, (_,prefix,letter)=>prefix+letter.toUpperCase())
    .replace(/,\s*Den(?:n)?is(?:e)?(?=[,.!?])/gi, '')
    .replace(/\bDen(?:n)?is(?:e)?(?:[’']s)?\b/gi, value => /[’']s$/i.test(value) ? 'the learner’s' : 'the learner')
    .replace(/(?<!\p{L})Д[еэ]н(?:н)?ис(ом|а|у|е)?(?!\p{L})/giu, (_,ending)=>
      ({'ом':'учеником','а':'ученика','у':'ученику','е':'ученике'}[ending as string] ?? 'ученик'))
    .replace(/(^|[.!?]\s+|\n)(the learner|ученик)/g, (_,prefix,role)=>prefix+role[0].toUpperCase()+role.slice(1));
  return result.replace(/\uE000(\d+)\uE001/g, (_,index)=>literals[Number(index)]);
}

function neutralResource(resource: Resource): Resource {
  let next = resource;
  for (const field of ['title','text','translation','prompt','answer'] as const) {
    const value = resource[field];
    if (typeof value !== 'string') continue;
    const clean = neutralLessonText(value);
    if (clean !== value) next = {...next,[field]:clean};
  }
  return next;
}
const content = (entry: Resource) => JSON.stringify([entry.kind,entry.title,entry.text ?? '',entry.prompt ?? '',entry.answer ?? '',entry.url ?? '',entry.translation ?? '']);
function neutralSnapshot(value: string): string {
  if (!/Den(?:n)?is(?:e)?|Д[еэ]н(?:н)?ис/iu.test(value)) return value;
  try {
    const fields: unknown=JSON.parse(value);
    if(!Array.isArray(fields) || fields.length!==7 || !fields.every(field=>typeof field==='string')) return value;
    return JSON.stringify(fields.map((field,index)=>index===0 || index===5 ? field : neutralLessonText(field)));
  } catch { return value; }
}

export function neutralLessonRoles(study: Study): Study {
  const resources = study.resources.map(neutralResource);
  const byId = new Map(resources.map(resource=>[resource.id,resource]));
  const archives = study.materialArchives?.map(batch=>{
    const entries=batch.entries.map(neutralResource);
    return entries.some((entry,i)=>entry!==batch.entries[i]) ? {...batch,entries} : batch;
  });
  let snapshotsChanged=false;
  const snapshots = study.topicPackageMaterials && Object.fromEntries(Object.entries(study.topicPackageMaterials).map(([id,entries])=>[
    id, entries.map(snapshot=>{
      const resource=byId.get(snapshot.id), clean=neutralSnapshot(snapshot.content);
      // Resource and managed snapshot can arrive on different pull pages. A name-only
      // normalization still matches; unrelated edits must never become managed again.
      if(resource && clean!==snapshot.content && clean===content(resource)) {
        snapshotsChanged=true;return {...snapshot,content:clean};
      }
      return snapshot;
    })
  ]));
  if (!snapshotsChanged && !resources.some((resource,i)=>resource!==study.resources[i]) &&
    !archives?.some((batch,i)=>batch!==study.materialArchives?.[i])) return study;
  return {...study,resources,...(snapshots ? {topicPackageMaterials:snapshots} : {}),...(archives ? {materialArchives:archives} : {})};
}
