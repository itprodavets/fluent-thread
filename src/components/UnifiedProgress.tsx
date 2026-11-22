import { useMemo, useState, useEffect, useSyncExternalStore } from 'react';
import { useWorkspace } from '../context';
import { useIdentity, useProfileStore } from '../profiles';
import { unifiedProgress, progressRowsPage } from '../domain/unified-progress';
import type { ProgressCategoryId, ProgressFilter } from '../domain/unified-progress';
import { modeLabels } from '../domain/model';
import skills from '../../materials/en/skills/catalog.json';
import { statusLabels } from './ProfileSummary';

const skillPhrases=skills.flatMap(skill=>skill.dialogues.flatMap(dialogue=>dialogue.phrases));
const statusLabelsById={all:'Все',new:'Ещё не пробовал',learning:'Изучаю',independent:'Самостоятельно',due:'Пора повторить',assisted:'Исправил с подсказкой',retry:'Ещё исправляю'};
type Filter=ProgressFilter;
const pageSize=30;

export function UnifiedProgress() {
  const {study,practice}=useWorkspace();
  const {user}=useIdentity();
  const store=useProfileStore();
  const sync=useSyncExternalStore(store.subscribe,store.getStatus);
  const [now,setNow]=useState(Date.now);
  const [categoryId,setCategory]=useState<ProgressCategoryId>('words');
  const [filter,setFilter]=useState<Filter>('independent');
  const [page,setPage]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer);},[]);
  const categories=useMemo(()=>unifiedProgress(study,now,study.language==='en'?skillPhrases:[]),[study,now]);
  const category=categories.find(item=>item.id===categoryId)!;
  const result=useMemo(()=>progressRowsPage(category.rows,filter,page,pageSize),[category,filter,page]);
  const {rows:visible,total,page:currentPage,maxPage}=result;
  function choose(id:ProgressCategoryId,next:Filter=filter){setCategory(id);setFilter(id!=='mistakes'&&['assisted','retry'].includes(next)?'learning':next);setPage(0);}
  return <section className="unified-progress" aria-label="Единый прогресс профиля">
    <div className="progress-board">
      <h2>Твой прогресс по всем разделам</h2>
      <p><strong>{user?study.profileName||user.user_metadata.display_name||user.email:'Без входа · этот браузер'}</strong> · {statusLabels[sync.state]}</p>
      <p className="sub">За всё время по выбранному языку. «Самостоятельно» — последняя оценка речи или письма без подсказки. Открытие материала и импорт слов не означают, что они изучены.</p>
      <div className="unified-progress-grid">{categories.map(item=><article key={item.id} className="unified-progress-card">
        <h3>{item.title}</h3>
        <p className="unified-progress-number"><strong>{item.independent.toLocaleString('ru')}</strong> / {item.total.toLocaleString('ru')}</p>
        <p className="sub">{item.id==='mistakes'?'Исправлено самостоятельно':'Самостоятельно'}</p>
        <div className="unified-progress-counts">
          <button type="button" onClick={()=>choose(item.id,'new')}>Ещё не пробовал <strong>{item.new.toLocaleString('ru')}</strong></button>
          {item.id==='mistakes'?<>
            <button type="button" onClick={()=>choose(item.id,'retry')}>Ещё исправляю <strong>{item.retry.toLocaleString('ru')}</strong></button>
            <button type="button" onClick={()=>choose(item.id,'assisted')}>Исправил с подсказкой <strong>{item.assisted.toLocaleString('ru')}</strong></button>
          </>:<button type="button" onClick={()=>choose(item.id,'learning')}>Изучаю / с подсказкой <strong>{item.learning.toLocaleString('ru')}</strong></button>}
          <button type="button" onClick={()=>choose(item.id,'due')}>Пора повторить <strong>{item.due.toLocaleString('ru')}</strong></button>
          <button type="button" onClick={()=>choose(item.id,'independent')}>Показать самостоятельные →</button>
        </div>
        {item.completedPractice>0&&<p className="sub">Собственных практик завершено и сохранено: {item.completedPractice}. Они не становятся автоматически изученными образцами.</p>}
      </article>)}</div>
      <p className="sub">Фразы — часть словаря, эти числа не складываются. Здесь учитываются сохранённые фразы, связанные с уроками и навыками. «Пора повторить» может включать уже освоенные карточки. Активный/пассивный словарь и импортированная история Anki не заменяют оценку в приложении.</p>
    </div>
    <div className="progress-board">
      <h2>Что уже получается и что повторить</h2>
      <div className="unified-progress-filters">
        <label>Раздел<select value={categoryId} onChange={e=>choose(e.target.value as ProgressCategoryId)}>{categories.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Статус<select value={filter} onChange={e=>choose(categoryId,e.target.value as Filter)}>{Object.entries(statusLabelsById).filter(([id])=>categoryId==='mistakes'||!['assisted','retry'].includes(id)).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      <p role="status">{category.title} · {statusLabelsById[filter]}: {total.toLocaleString('ru')}</p>
      {!total?<p className="sub">Пока нет результатов с этим статусом. Попробуй задание и оцени свой ответ — результат появится здесь.</p>:<ul className="unified-progress-list">{visible.map(row=><li key={row.id}>
        <div className="unified-progress-row"><div><strong>{row.title}</strong><p className="sub">{row.status==='independent'?(row.mistake?'Исправил самостоятельно':'Самостоятельно'):row.status==='new'?'Ещё не пробовал':row.outcome==='assisted'?'С подсказкой':'Изучаю'}{row.mode&&' · '+modeLabels[row.mode]}{row.due&&' · Пора повторить'}</p></div>
          {row.target==='review'?<a className="button" href="#today/review">Открыть очередь повторения</a>:row.target==='mistake'?<a className="button" href="#materials/mistakes">К повторению ошибок</a>:<button type="button" onClick={()=>practice(row.id)}>Тренировать</button>}
        </div>
        {row.mistake&&<details><summary>Было → стало и мой ответ</summary><p><strong>Было:</strong> {row.mistake.correction.before}</p><p><strong>Лучше:</strong> {row.mistake.correction.after}</p><p>{row.mistake.correction.reason}</p>{row.mistake.last?<><p><strong>Моя последняя сохранённая попытка:</strong> {row.mistake.last.answer}</p><p className="sub">{row.mistake.last.assessment==='assisted'?'Исправление с подсказкой.':row.mistake.reviewMode==='self-check'?'Результат по собственной проверке.':'Результат проверки учебной конструкции.'}</p></>:<p className="sub">Собственной попытки повторения пока нет.</p>}</details>}
      </li>)}</ul>}
      {total>pageSize&&<div className="actions" aria-label="Страницы результатов"><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>← Назад</button><span>{currentPage+1} / {maxPage+1}</span><button type="button" disabled={currentPage===maxPage} onClick={()=>setPage(currentPage+1)}>Далее →</button></div>}
    </div>
  </section>;
}
