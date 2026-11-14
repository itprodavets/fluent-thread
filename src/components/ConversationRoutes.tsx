import { useState } from 'react';
import { useWorkspace } from '../context';
import { Fold, SourceText } from './common';

import type { ConversationRoute, ConversationStep } from '../domain/conversation-route';

const example: ConversationRoute = {
  id: 'example-day', language: 'en', title: 'A Walk Before Work',
  steps: [
    { id: 'walk', title: 'On a Morning Walk', transition: '', dialogue: 'Sam: Alex? I didn’t expect to see you here this early.\nAlex: Hi, Sam! I’m taking a walk before work. Do you come here often?\nSam: Most mornings. Have you got time for a coffee?\nAlex: I’ve got twenty minutes. Let’s try the place by the park.' },
    { id: 'coffee', title: 'Coffee with a Friend', transition: 'Sam suggests coffee, so we stop at the café by the park.', dialogue: 'Sam: You mentioned a big meeting this week. Is that today?\nAlex: Yes, at nine. We’re reviewing the new plan.\nSam: Are you ready for it?\nAlex: Mostly. I still need to check a couple of figures with Nina. I should head off soon.\nSam: Of course. Good luck!\nAlex: Thanks. Let’s do this again next week.' },
    { id: 'office', title: 'Arriving at Work', transition: 'After coffee, I head to the office to check the figures before the meeting.', dialogue: 'Nina: Morning! Do you have everything for the meeting?\nAlex: Almost. Could we go over the last two figures together?\nNina: Sure. I updated them this morning. Did you get my message?\nAlex: I haven’t seen it yet. Can you show me what changed?\nNina: Of course. Let’s open the report.\nAlex: Thanks. Once we’ve checked it, I’ll send the final version.' }
  ]
};
const blankStep = (): ConversationStep => ({ id: crypto.randomUUID(), title: '', transition: '', dialogue: '' });

export function ConversationRoutes() {
  const { study, update, notify } = useWorkspace();
  const routes = (study.conversationRoutes ?? []).filter(route => route.language === study.language);
  const options = study.language === 'en' ? [example, ...routes] : routes;
  const [id, select] = useState(options[0]?.id ?? '');
  const route = options.find(r => r.id === id);
  const [stepId, selectStep] = useState('');
  const [draft, edit] = useState<ConversationRoute>();
  const [busy, setBusy] = useState(false);
  const step = route?.steps.find(s => s.id === stepId) ?? route?.steps[0];
  function newRoute() { edit({ id: crypto.randomUUID(), language: study.language, title: '', steps: [blankStep()] }); }
  function changeStep(id: string, change: Partial<ConversationStep>) {
    edit(current => current && ({ ...current, steps: current.steps.map(step => step.id === id ? { ...step, ...change } : step) }));
  }
  async function save() {
    if (!draft || busy) return;
    const route = { ...draft, title: draft.title.trim(), steps: draft.steps.map((s, i) => ({ ...s, title: s.title.trim(), dialogue: s.dialogue.trim(), transition: i ? s.transition.trim() : '' })) };
    if (!route.title || route.steps.some(s => !s.title || !s.dialogue)) { notify('Заполни название маршрута, события и реплики.'); return; }
    setBusy(true);
    try {
      if (await update(current => ({ ...current, conversationRoutes: [...(current.conversationRoutes ?? []).filter(r => r.id !== route.id), route] }))) {
        select(route.id); selectStep(''); edit(undefined);
      }
    } finally { setBusy(false); }
  }
  return <section className="conversation-routes" aria-labelledby="routes-title">
    <h2 id="routes-title">Маршрут разговора</h2>
    <p className="sub">Собери цепочку событий. Каждый шаг открывает свой диалог или собеседование.</p>
    <div className="actions">
      {options.length > 0 && <label>Маршрут<select value={id} onChange={e => { select(e.target.value); selectStep(''); edit(undefined); }}>
        {options.map(r => <option key={r.id} value={r.id}>{r.title}{r.id === example.id ? ' · пример' : ''}</option>)}
      </select></label>}
      <button type="button" onClick={newRoute}>Новый маршрут</button>
      {route && <button type="button" onClick={() => edit(route.id === example.id ? { ...route, id: crypto.randomUUID() } : route)}>{route.id === example.id ? 'Взять пример за основу' : 'Редактировать маршрут'}</button>}
    </div>
    {draft ? <form className="resource" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>Название маршрута<input required maxLength={120} value={draft.title} onChange={e => edit({ ...draft, title: e.target.value })} /></label>
      {draft.steps.map((s, index) => <fieldset key={s.id}>
        <legend>Событие {index + 1}</legend>
        {index > 0 && <label>Что связывает с предыдущим событием<input maxLength={400} value={s.transition} onChange={e => changeStep(s.id, { transition: e.target.value })} /></label>}
        <label>Название события<input required maxLength={120} value={s.title} onChange={e => changeStep(s.id, { title: e.target.value })} /></label>
        <label>Диалог — вопросы и ответы<textarea required maxLength={12000} rows={6} value={s.dialogue} onChange={e => changeStep(s.id, { dialogue: e.target.value })} /></label>
        <div className="actions">
          {index > 0 && <button type="button" onClick={() => {
            const steps = [...draft.steps]; [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
            // A transition describes a particular pair of events, so clear transitions whose preceding event changed.
            const previous = new Map(draft.steps.map((item, i) => [item.id, draft.steps[i - 1]?.id]));
            edit({ ...draft, steps: steps.map((item, i) => previous.get(item.id) === steps[i - 1]?.id ? item : { ...item, transition: '' }) });
          }}>Выше</button>}
          {draft.steps.length > 1 && <button type="button" onClick={() => edit({ ...draft, steps: draft.steps.filter(item => item.id !== s.id).map(item => item.id === draft.steps[index + 1]?.id ? { ...item, transition: '' } : item) })}>Убрать шаг</button>}
        </div>
      </fieldset>)}
      <div className="actions"><button type="button" disabled={draft.steps.length >= 30} onClick={() => edit({ ...draft, steps: [...draft.steps, blankStep()] })}>Добавить событие</button><button className="primary" disabled={busy}>Сохранить маршрут</button><button type="button" onClick={() => edit(undefined)}>Отмена</button></div>
    </form> : route && step && <>
      <ol className="conversation-steps" aria-label="Последовательность событий">
        {route.steps.map((s, index) => <li key={s.id}>
          {index > 0 && <span className="conversation-arrow" aria-label="Затем">↓</span>}
          <button type="button" aria-current={s.id === step.id ? 'step' : undefined} onClick={() => selectStep(s.id)}>{s.title}</button>
          {s.transition && <p className="sub">{s.transition}</p>}
        </li>)}
      </ol>
      <article className="resource" key={step.id}>
        <h3 lang={route.language}>{step.title}</h3>
        <Fold title="Открыть диалог" open><SourceText text={step.dialogue} language={route.language} /></Fold>
        {route.steps.indexOf(step) < route.steps.length - 1 && <button type="button" onClick={() => selectStep(route.steps[route.steps.indexOf(step) + 1].id)}>Следующее событие →</button>}
      </article>
    </>}
  </section>;
}
