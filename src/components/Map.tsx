import { ConversationRoutes } from './ConversationRoutes';
import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useWorkspace } from '../context';
import { normalize, topicMaterials, upsert } from '../domain/model';
import type { MapPoint, Topic } from '../domain/model';
import { starterTopics } from '../domain/starter-topics';
import { Fold, Heading, SourceText, copyText } from './common';
import { AnkiHistory } from './AnkiHistory';
import { LearningCanvas } from './LearningCanvas';
import { buildLearningGraph, projectLearningGraph } from '../domain/learning-graph';
import { materialLessonHref } from '../domain/material-route';
import { learningNodeLabels, learningFocusPage } from './learning-map-view';
import datedLessons from '../../materials/en/lessons/catalog.json';
import skills from '../../materials/en/skills/catalog.json';
import { WordExamples } from './WordExamples';

const positions = [[22, 24], [77, 24], [18, 51], [82, 51], [23, 78], [76, 78]];

type Branch = Pick<Topic, 'id' | 'title' | 'language'>;

function Network({ title, branches, selected, select, label, more }: {
  title: string; branches: Branch[]; selected?: string; select: (id: string) => void; label: string; more: string;
}) {
  const nodes = branches.slice(0, positions.length);
  return <>
    <div className="network" aria-label={label}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {nodes.map((word, index) => {
          const [x, y] = positions[index];
          return <path key={word.id} className={selected === word.id ? 'active' : ''} d={`M50 50 C${x} 50 50 ${y} ${x} ${y}`} />;
        })}
      </svg>
      <div className="core">{title}</div>
      {nodes.map((word, index) => <button key={word.id} className="word-node" type="button" aria-pressed={selected === word.id}
        style={{ left: positions[index][0] + '%', top: positions[index][1] + '%' }} lang={word.language} onClick={() => select(word.id)}>{word.title}</button>)}
    </div>
    {branches.length > nodes.length && <Fold title={`${more} · ${branches.length}`}>
      <div className="actions">{branches.map(word => <button key={word.id} type="button" onClick={() => select(word.id)}>{word.title}</button>)}</div>
    </Fold>}
  </>;
}

function TopicEditor({ entry, position, finish }: { entry?: Topic; position?: MapPoint; finish: (id: string) => void }) {
  const { study, active, update, notify } = useWorkspace();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(() => new Set(entry?.links));
  const [limit, setLimit] = useState(30);
  const [command, setCommand] = useState('');
  const found = useMemo(() => {
    const search = normalize(query, study.language);
    return search ? active.words.filter(word => normalize([word.title, word.meaning, word.example].join(' '), study.language).includes(search)) : active.words;
  }, [query, active.words, study.language]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title')).trim();
    if (!title) { notify('Введи название темы.'); return; }
    const materials = entry ? topicMaterials(entry) : [];
    const text = String(data.get('material')).trim();
    const next: Topic = {
      ...entry, position: entry ? entry.position : position, id: entry?.id ?? crypto.randomUUID(), title, language: study.language, links: [...chosen],
      prompt: String(data.get('prompt')).trim(),
      materials: text && !materials.some(material => material.text === text) ? [...materials, { format: String(data.get('format')), text }] : materials
    };
    if (await update(current => ({ ...current, topics: upsert(current.topics, next) }))) {
      notify('Тема сохранена.');
      finish(next.id);
    }
  }

  function prepare(form: HTMLFormElement) {
    const data = new FormData(form);
    const title = String(data.get('title')).trim();
    if (!title) { notify('Введи название ситуации.'); return; }
    const selected = active.words.filter(word => chosen.has(word.id));
    const words = selected.map(word => [word.title, word.meaning, word.example].filter(Boolean).join(' · '));
    const text = `Я изучаю ${study.language}. Ситуация — ${title}. Напиши ${data.get('format')} на изучаемом языке для устной практики.` +
      (words.length ? '\nИспользуй эти слова и их контексты:\n' + words.join('\n') : '');
    setCommand(text);
    void copyText(text, notify);
  }

  return <form onSubmit={submit}>
    <label>Ситуация <input name="title" autoFocus required maxLength={90} defaultValue={entry?.title} placeholder="Я в офисе" /></label>
    <label>Что сказать вслух <textarea name="prompt" rows={2} defaultValue={entry?.prompt} placeholder="Вспомни конкретную ситуацию: что произошло и как ты поступил" /></label>
    {active.words.length > 0 && <fieldset><legend>Слова и контекст из Anki · выбрано {chosen.size}</legend>
      <label>Поиск по колоде <input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); }} placeholder="Слово или фраза" /></label>
      <div className="choices">{found.slice(0, limit).map(word =>
        <label className="choice" key={word.id}><input type="checkbox" checked={chosen.has(word.id)} onChange={event => {
          const checked = event.target.checked;
          setChosen(previous => {
            const next = new Set(previous);
            if (checked) next.add(word.id); else next.delete(word.id);
            return next;
          });
        }} /><span><strong lang={word.language}>{word.title}</strong>{word.example && <small lang={word.language}>{word.example}</small>}</span></label>
      )}</div>
      {found.length > limit && <button type="button" onClick={() => setLimit(value => value + 30)}>Показать ещё</button>}
    </fieldset>}
    <div className="actions"><select name="format" aria-label="Вид материала"><option>диалог</option><option>предложения</option><option>рассказ</option></select>
      <button type="button" onClick={event => prepare(event.currentTarget.form!)}>Подготовить запрос для ИИ</button></div>
    {command && <label>Запрос для чата <textarea readOnly rows={5} value={command} /></label>}
    <label>Добавить материал <textarea name="material" rows={4} placeholder="Вставь текст из чата или напиши свой" /></label>
    <button type="submit" className="primary">Сохранить тему</button>
  </form>;
}

function StarterMap() {
  const { study, update, notify, openTopic } = useWorkspace();
  const examples = starterTopics(study.language);
  const [selected, choose] = useState(examples[0].id);
  const topic = examples.find(example => example.id === selected) ?? examples[0];
  async function copy() {
    const match = (entry: Topic) => entry.language === topic.language && entry.title === topic.title;
    let id = topic.id;
    if (await update(current => {
      const existing = current.topics.find(match);
      if (existing) { id = existing.id; return current; }
      return { ...current, topics: upsert(current.topics, topic) };
    })) {
      notify('Тема доступна на твоей карте.');
      openTopic(id);
    }
  }
  return <div className="starter-map">
    <p className="sub">Выбери ветку, чтобы посмотреть задание и добавить тему на свою карту.</p>
    <Network title="Повседневная речь" branches={examples} selected={topic.id} select={choose} label="Пример сети тем" more="Все примеры" />
    <div className="word-detail">
      <h2 lang={topic.language}>{topic.title}</h2>
      <p>{topic.prompt}</p>
      {topicMaterials(topic).map(material => <div key={material.text}><p className="kicker">{material.format}</p><SourceText text={material.text} language={topic.language} /></div>)}
      <div className="actions"><button className="primary" type="button" onClick={copy}>Добавить эту тему</button></div>
    </div>
  </div>;
}

export function MapPage() {
  const { study, active, topicId, openTopic, openResource, practice } = useWorkspace();
  const [selectedId, select] = useState<string>();
  const [focusId, focus] = useState<string>();
  const [pagination, setPagination] = useState<{ focusId?: string; page: number }>({ page: 0 });
  const graph = useMemo(() => buildLearningGraph(study, datedLessons, skills), [study]);
  const focused = graph.nodes.find(node => node.id === focusId) ?? graph.nodes.find(node => node.id === topicId) ?? graph.nodes.find(node => node.type === 'lesson');
  const focusView = projectLearningGraph(graph, focused?.id, learningFocusPage(pagination, focused?.id));
  function selectNode(id: string) {
    focus(id);
    setPagination({ focusId: id, page: 0 });
    const node = graph.nodes.find(entry => entry.id === id);
    if (node?.topicId) openTopic(node.topicId);
  }
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; revision: number }>({ mode: 'new', revision: 0 });
  const [formVisible, setFormVisible] = useState(false);
  const [newPosition, setNewPosition] = useState<MapPoint>();
  const details = useRef<HTMLDetailsElement>(null);
  const topic = active.topics.find(entry => entry.id === (focused?.topicId ?? topicId)) ?? active.topics[0];
  const linked = useMemo(() => {
    const ids = new Set(topic?.links);
    return active.words.filter(word => ids.has(word.id));
  }, [active.words, topic]);
  const selected = linked.find(word => word.id === selectedId);
  const resources = topic ? active.resources.filter(entry => entry.topicId === topic.id) : [];

  function create(position?: MapPoint) {
    setNewPosition(position);
    setEditor(previous => ({ mode: 'new', revision: previous.revision + 1 }));
    setFormVisible(true);
    if (details.current) { details.current.open = true; details.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }

  function edit() {
    setNewPosition(undefined);
    setFormVisible(true);
    setEditor(previous => ({ mode: 'edit', revision: previous.revision + 1 }));
    if (details.current) { details.current.open = true; details.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }

  return <><Heading title="Карта разговорных тем" />
    <LearningCanvas key={study.language} graph={graph} projection={focusView} onPageChange={page => setPagination({ focusId: focused?.id, page })} selected={focused?.id} onSelect={selectNode} onCreate={create} />
    {focused && <section className="learning-map-detail" aria-label="Выбранный узел">
      <p className="kicker">{learningNodeLabels[focused.type]}</p><h2 lang={focused.language}>{focused.title}</h2>
      {focused.school && focused.type !== 'school' && <p>{focused.school}</p>}
      {focused.type === 'dialogue' && <><p>Доступные версии сцены — выбери уровень для точной практики.</p><div className="actions">{[...(focused.versions ?? [])].sort((a, b) => (a.level ?? '').localeCompare(b.level ?? '')).map(version => <a key={version.id} href={materialLessonHref(focused.topicId!, version.id)}>{version.level ?? 'Без уровня'}</a>)}</div></>}
      {focused.type === 'lesson' && <div className="actions"><a href={materialLessonHref(focused.topicId ?? focused.id)}>Открыть материалы урока</a><button type="button" onClick={() => practice(focused.topicId ?? focused.id)}>Практиковать тему</button><button type="button" onClick={edit}>Изменить тему</button></div>}
      {(focused.type === 'school' || focused.type === 'skill') && <>
        <p>{focused.type === 'school' ? 'Уроки этой школы доступны на карте. Следующие страницы связей находятся над графом.' : 'Связанные сцены из твоих уроков. Следующие страницы связей находятся над графом.'}</p>
        <div className="actions">{focusView.nodes.filter(node => focused.type === 'school' ? node.type === 'lesson' : node.type === 'dialogue').map(node => <div key={node.id}><button type="button" onClick={() => selectNode(node.id)}>{node.title}{node.school ? ' · ' + node.school : ''}</button>{focused.type === 'skill' && node.topicId && node.versions?.map(version => <a key={version.id} href={materialLessonHref(node.topicId!, version.id, focused.skillId)}>Практика · {version.level ?? 'Без уровня'}</a>)}</div>)}</div>
        {focusView.nodes.length <= 1 && <p>Связанных материалов пока нет. Обзор всей карты доступен выше.</p>}
      </>}
      {focused.type !== 'lesson' && topic && <button type="button" onClick={() => selectNode(topic.id)}>Вернуться к уроку: {topic.title}</button>}
    </section>}
    <div className="map-layout map-page-layout">
      <section className="map-workspace">
        {topic ? <>
          <div className="map-selection">
          <h2 lang={topic.language}>{topic.title}</h2>
          {topic.prompt && <p>{topic.prompt}</p>}
          <label className="compact-field">Тема <select value={topic.id} onChange={event => {
            openTopic(event.target.value); focus(event.target.value); select(undefined); setNewPosition(undefined); setEditor(previous => ({ mode: 'new', revision: previous.revision + 1 }));
          }}>{active.topics.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
          <div className="actions"><button className="primary" type="button" onClick={() => practice(topic.id)}>Практиковать тему</button><button type="button" onClick={edit}>Изменить тему</button></div>
          {topicMaterials(topic).length > 0 && <Fold title={`Примеры к теме · ${topicMaterials(topic).length}`}>
            {topicMaterials(topic).map(material => <Fold key={material.text} title={material.format}><SourceText text={material.text} language={topic.language} /></Fold>)}
          </Fold>}
          {resources.length > 0 && <Fold title={`Из библиотеки · ${resources.length}`}>
            <div className="actions">{resources.map(resource => <button key={resource.id} type="button" onClick={() => openResource(resource.id)}>{resource.title}</button>)}</div>
          </Fold>}
          <Fold title={`Слова темы · ${linked.length}`}>
          <Network title={topic.title} branches={linked} selected={selected?.id} select={select} label="Тема и связанные слова" more="Все слова темы" />
          {selected && <div className="word-detail">
            <strong lang={selected.language}>{selected.title}</strong>
            {selected.meaning && <p>{selected.meaning}</p>}
            <WordExamples key={selected.id} word={selected} />
            <AnkiHistory key={selected.id} word={selected} />
          </div>}
          </Fold>
          </div>
        </> : <StarterMap key={study.language} />}
        {topic && <Fold title="Карта-пример"><StarterMap key={study.language} /></Fold>}
      </section>
      <details ref={details} className="fold editor" open={!topic || undefined} onToggle={event => {
        const open = event.currentTarget.open;
        setFormVisible(open);
        if (!open) {
          setNewPosition(undefined);
          setEditor(previous => ({ mode: 'new', revision: previous.revision + 1 }));
        }
      }}>
        <summary>{editor.mode === 'edit' ? 'Редактировать тему' : 'Новая тема'}</summary>
        {(formVisible || !topic) && <TopicEditor key={study.language + ':' + editor.revision + ':' + (editor.mode === 'edit' ? topic?.id : 'new')} position={editor.mode === 'new' ? newPosition : undefined} entry={editor.mode === 'edit' ? topic : undefined} finish={id => {
          openTopic(id);
          focus(id);
          setNewPosition(undefined);
          setEditor(previous => ({ mode: 'new', revision: previous.revision + 1 }));
          if (details.current) details.current.open = false;
        }} />}
      </details>
    </div>
    <Fold title="Разговорные маршруты"><ConversationRoutes key={study.language} /></Fold>
  </>;
}
