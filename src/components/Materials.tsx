import { isStarterResource } from '../domain/starter-materials';
import { LessonAudio } from './LessonAudio';
import { lessonCues, lessonTopicTitle } from '../domain/lesson-cues';
import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useWorkspace } from '../context';
import { applyChatPackage, archiveMaterial, approveTopicMaterials, replaceTopicPackage, restoreMaterialArchive, topicImportPreview, buildChatPrompt, parseChatPackage, safeSourceUrl } from '../domain/chat-package.js';
import { languageCodes, LanguageLabel } from './Language';
import { suggestMaterialLanguage } from '../domain/language-detection';
import { kinds, languageName, selectLanguage, upsert } from '../domain/model';
import type { MaterialKind, Resource } from '../domain/model';
import { Recording } from './Recording';
import { StoryVersions } from './StoryVersions';
import { StarterMaterials } from './StarterMaterials';
import { copyText, Fold, Heading, SourceLink, SourceText } from './common';

function TopicSelect({ value, change, fallback, language }: { value: string; change: (id: string) => void; fallback: string; language?: string }) {
  const { study } = useWorkspace();
  const topics = study.topics.filter(topic => topic.language === (language ?? study.language));
  return <select value={value} onChange={event => change(event.target.value)}>
    <option value="">{fallback}</option>
    {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
  </select>;
}

function MaterialForm({ resource, done }: { resource?: Resource; done: (id: string) => void }) {
  const { study, notify, update } = useWorkspace();
  const [title, setTitle] = useState(resource?.title ?? '');
  const [text, setText] = useState(resource?.text ?? '');
  const [kind, setKind] = useState<MaterialKind>(resource?.kind ?? 'reading');
  const [answer, setAnswer] = useState(resource?.answer ?? '');
  const [topic, setTopic] = useState(resource?.topicId ?? '');
  const [override, setOverride] = useState('');
  const detected = useMemo(() => resource ? undefined : suggestMaterialLanguage(kind === 'exercise' ? answer : text),
    [resource, kind, answer, text]);
  const language = resource?.language ?? (override || detected || study.language);
  const selectedTopic = study.topics.find(entry => entry.id === topic && entry.language === language)?.id;
  const options = [...new Set([study.language, language, ...Object.keys(study.languages), ...languageCodes])];

  async function importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (!/\.(?:txt|md)$/i.test(file.name) || file.size > 1_000_000) { notify('Выбери файл .txt или .md до 1 МБ.'); return; }
    try {
      const contents = (await file.text()).trim();
      if (!input.isConnected || input.files?.[0] !== file) return;
      if (!contents || contents.length > 250000) throw new Error();
      setText(contents);
      setTitle(current => current || file.name.replace(/\.[^.]+$/, '').slice(0, 120));
      notify('Текст добавлен в форму. Сохрани материал.');
    } catch { notify('Не удалось прочитать текст. Можно вставить его вручную.'); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawUrl = String(form.get('url')).trim();
    const url = safeSourceUrl(rawUrl);
    const prompt = String(form.get('prompt')).trim();
    if (!title.trim()) { notify('Укажи название материала.'); return; }
    if (rawUrl && !url) { notify('Нужна ссылка с https:// или http://.'); return; }
    if (!text.trim() && !url && !(kind === 'exercise' && prompt)) { notify('Добавь текст, ссылку или условие упражнения.'); return; }
    const entry: Resource = {
      ...resource,
      id: resource?.id ?? crypto.randomUUID(), title: title.trim(), language, kind, text: text.trim(), prompt, url,
      topicId: selectedTopic,
      translation: String(form.get('translation')).trim() || undefined,
      answer: kind === 'exercise' ? answer.trim() : ''
    };
    if (await update(current => ({ ...selectLanguage(current, language), resources: upsert(current.resources, entry) }))) {
      notify('Материал сохранён.');
      done(entry.id);
    }
  }

  return <form onSubmit={submit}>
    <label>Название <input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Например, «Как прошла встреча»" /></label>
    <div className="form-pair">
      <label>Тип материала <select value={kind} onChange={event => setKind(event.target.value as MaterialKind)}>
        {Object.entries(kinds).map(([value, entry]) => <option key={value} value={value}>{entry.label}</option>)}
      </select></label>
      <label>Тема на карте <TopicSelect value={selectedTopic ?? ''} change={setTopic} fallback="Без темы" language={language} /></label>
    </div>
    <label>Импортировать текст <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event => void importFile(event.currentTarget)} /></label>
    <label>Текст, диалог или условия задания <textarea rows={5} maxLength={250000} value={text} onChange={event => setText(event.target.value)} /></label>
    <div className="import-language"><LanguageLabel code={language} /><small>{detected && !override ? 'Определён по тексту' : override || resource ? 'Язык материала' : 'Текущий язык'}</small></div>
    {!resource && <details className="fold language-override"><summary>Уточнить язык материала</summary>
      <label>Язык текста <select value={override} onChange={event => setOverride(event.target.value)}>
        <option value="">Автоматически</option>
        {options.map(code => <option key={code} value={code}>{languageName(code)}</option>)}
      </select></label>
    </details>}
    <label>Перевод на русский <textarea name="translation" rows={3} defaultValue={resource?.translation} maxLength={250000} /></label>
    <label>Ссылка на источник <input name="url" type="url" defaultValue={resource?.url} maxLength={2000} placeholder="https://…" /></label>
    <label>Что сделать или сказать <textarea name="prompt" rows={2} defaultValue={resource?.prompt} maxLength={4000} /></label>
    {kind === 'exercise' && <label>Ответ для сравнения <textarea name="answer" rows={3} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={12000} /></label>}
    <button type="submit" className="primary">Сохранить материал</button>
  </form>;
}

function ChatExchange({ source, setSource }: { source?: Resource; setSource: (resource?: Resource) => void }) {
  const { study, active, notify, update, openTopic } = useWorkspace();
  const [target, setTarget] = useState<string>();
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = target ?? source?.topicId ?? '';
  const [mode, setMode] = useState('append');
  const [preview, setPreview] = useState<{ packet: ReturnType<typeof parseChatPackage>; topicId: string; approved: ReturnType<typeof approveTopicMaterials>; rows: ReturnType<typeof topicImportPreview> }>();
  const [checked, setChecked] = useState<string[]>([]);
  async function replace() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      let archived = 0;
      const saved = await update(current => {
        const result = replaceTopicPackage(current, preview.packet, preview.topicId, preview.approved.filter(entry => checked.includes(entry.id)));
        archived = result.archived;
        return result.next;
      });
      if (saved) { setPreview(undefined); notify(`Тема обновлена. В архиве: ${archived}.`); openTopic(preview.topicId); }
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось обновить тему.'); }
    finally { setBusy(false); }
  }
  function prepare() {
    const topic = active.topics.find(entry => entry.id === selected);
    const content = source && { title: source.title, ...(source.text ? { text: source.text } : {}), ...(source.url ? { url: source.url } : {}) };
    const text = buildChatPrompt(study.language, topic?.title, content);
    setCommand(text);
    void copyText(text, notify);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file') as File;
    const pasted = String(data.get('json')).trim();
    if (!file.size && !pasted) { notify('Выбери файл из чата или вставь JSON.'); return; }
    if (file.size && pasted) { notify('Используй файл или вставь JSON в поле.'); return; }
    if (file.size > 1_000_000) { notify('Файл должен быть меньше 1 МБ.'); return; }
    setBusy(true);
    try {
      const packet = parseChatPackage(file.size ? await file.text() : pasted);
      if (packet.language === 'en') packet.topic.title = lessonTopicTitle(packet.topic.title);
      if (mode === 'replace') {
        const topic = study.topics.find(t => t.id === selected && t.language === packet.language);
        if (!topic) throw new Error('Выбери существующую тему на языке пакета.');
        const rows = topicImportPreview(study, topic.id);
        setChecked(rows.filter(row => row.selected).map(row => row.id));
        setPreview({ packet, topicId: topic.id, rows, approved: approveTopicMaterials(study, topic.id, rows.map(row => row.id)) });
        return;
      }
      let result: ReturnType<typeof applyChatPackage> | undefined;
      const saved = await update(current => {
        if (current.language !== study.language) throw new Error('Активный язык изменился. Открой форму ещё раз.');
        if (selected && !current.topics.some(topic => topic.id === selected && topic.language === packet.language)) {
          throw new Error('Язык выбранной темы отличается от языка пакета. Выбери «Тема из файла».');
        }
        result = applyChatPackage(selectLanguage(current, packet.language), packet, selected);
        return result.next;
      });
      if (saved && result) {
        notify(`«${result.topic.title}» · новых слов ${result.wordsAdded} · новых материалов ${result.materialsAdded}`);
        openTopic(result.topic.id);
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось импортировать пакет.'); }
    finally { setBusy(false); }
  }
  return <>
    <form onSubmit={submit} hidden={!!preview}>
      <p className="sub">Выбери файл «Нити речи» или вставь JSON. Для замены старой версии выбери режим обновления.</p>
      {source && <div className="actions"><span>{source.title}</span><button type="button" onClick={() => { setSource(undefined); setCommand(''); }}>Убрать материал</button></div>}
      <label>Куда добавить <TopicSelect value={selected} change={setTarget} fallback="Тема из файла" /></label>
      <button type="button" onClick={prepare}>Копировать команду для чата</button>
      {command && <label>Команда для чата <textarea readOnly value={command} rows={6} /></label>}
      <label>Файл из чата <input type="file" name="file" accept=".json,application/json" /></label>
      <label>Или вставь JSON <textarea name="json" rows={4} maxLength={1000000} /></label>
      <label>Режим импорта<select value={mode} onChange={event => setMode(event.target.value)}>
        <option value="append">Добавить материалы</option><option value="replace">Обновить материалы темы</option>
      </select></label>
      <button type="submit" className="primary" disabled={busy}>{mode === 'replace' ? 'Предпросмотр замены' : 'Добавить в тему'}</button>
    </form>
    {preview && <section aria-label="Предпросмотр замены">
      <h3>{study.topics.find(t => t.id === preview.topicId)?.title}</h3>
      <p>В пакете материалов: {preview.packet.materials.length}. Отметь старые версии для архива. Точные совпадения останутся в теме.</p>
      <div className="actions"><button type="button" onClick={() => setChecked(preview.rows.map(row => row.id))}>Отметить все</button><button type="button" onClick={() => setChecked([])}>Снять отметки</button></div>
      {preview.rows.map(row => <label className="choice" key={row.id}><input type="checkbox" checked={checked.includes(row.id)} onChange={event => setChecked(event.target.checked ? [...checked, row.id] : checked.filter(id => id !== row.id))} />{row.title}</label>)}
      <div className="actions"><button type="button" className="primary" disabled={busy} onClick={() => void replace()}>Обновить тему · выбрано {checked.length}</button><button type="button" onClick={() => setPreview(undefined)}>Отмена</button></div>
    </section>}
  </>;
}

function MaterialText({ resource }: { resource: Resource }) {
  const [open, setOpen] = useState(false);
  const cues = lessonCues(resource.text);
  if (!cues.length) return <SourceText text={resource.text} language={resource.language} />;
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Оригинальная запись · {cues.length} реплик</summary>
    {open && <LessonAudio cues={cues} lesson={resource.text.match(/^Recording: (lesson-[123])$/m)?.[1] ?? resource.topicId ?? resource.id} language={resource.language} />}
  </details>;
}

export function Materials() {
  const { active, resourceId, practice, study, update } = useWorkspace();
  const [editing, setEditing] = useState<Resource>();
  const [source, setSource] = useState<Resource>();
  const [opened, setOpened] = useState(resourceId);
  const [revision, reset] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<'edit' | 'import' | 'archive'>();
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState<Resource>();
  const [busy, setBusy] = useState(false);
  const materials = active.resources.filter(resource => !isStarterResource(resource.id));
  function show(value: NonNullable<typeof panel>) {
    setPanel(value);
    if (!dialog.current?.open) dialog.current?.showModal();
  }
  function close() { dialog.current?.close(); }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try { if (await update(current => archiveMaterial(current, deleting.id))) close(); }
    finally { setBusy(false); }
  }
  return <><Heading title="Материалы" detail="Тексты, упражнения и записи для разговорной практики." />
    <div className="library">
      <StarterMaterials />
      <section aria-label="Мои материалы">
        <h2>Мои материалы</h2>
        <div className="actions">
          <button type="button" className="primary" onClick={() => { setEditing(undefined); reset(n => n + 1); show('edit'); }}>Добавить материал</button>
          <button type="button" onClick={() => { setSource(undefined); show('import'); }}>Импортировать из файла</button>
        </div>
        <label>Фильтр по теме<select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">Все темы</option><option value="unassigned">Без темы</option>
          {active.topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
        </select></label>
      </section>
      <dialog ref={dialog} className="material-dialog" aria-labelledby="material-dialog-title" onClose={() => { setPanel(undefined); setDeleting(undefined); }}>
        <header className="actions">
          <h2 id="material-dialog-title">{panel === 'import' ? 'Импорт материалов' : panel === 'archive' ? 'Удалить из библиотеки' : editing ? 'Изменить материал' : 'Добавить материал'}</h2>
          <button type="button" onClick={close}>Закрыть</button>
        </header>
        {panel === 'edit' && <MaterialForm key={revision} resource={editing} done={id => { setOpened(id); close(); }} />}
        {panel === 'import' && <ChatExchange key={source?.id ?? 'all'} source={source} setSource={setSource} />}
        {panel === 'archive' && deleting && <>
          <p>«{deleting.title}» переместится в архив. Его можно вернуть из раздела «Архив версий материалов».</p>
          <div className="actions"><button type="button" className="primary" disabled={busy} onClick={() => void remove()}>Переместить в архив</button><button type="button" onClick={close}>Отмена</button></div>
        </>}
      </dialog>
      {!!study.materialArchives?.length && <Fold title="Архив версий материалов">
        {study.materialArchives.map(batch => <div className="actions" key={batch.id}>
          <span>{study.topics.find(t => t.id === batch.topicId)?.title ?? 'Без темы'} · {batch.entries.map(entry => entry.title).join(', ')} · {new Date(batch.at).toLocaleString('ru')} · {batch.entries.length}</span>
          <button type="button" onClick={() => void update(current => restoreMaterialArchive(current, batch.id))}>Вернуть материалы</button>
        </div>)}
      </Fold>}
      <div className="library-list">{materials.filter(resource => !filter || (resource.topicId ?? 'unassigned') === filter).map(resource => {
        const kind = kinds[resource.kind];
        const topic = active.topics.find(entry => entry.id === resource.topicId);
        return <article key={resource.id} className="resource">
          <p className="kicker"><LanguageLabel code={resource.language} /> · {kind.label}{topic && ' · ' + topic.title}</p>
          <h2>{resource.title}</h2>
          <SourceLink url={resource.url} />
          {resource.text && <Fold title={resource.kind === 'exercise' ? 'Читать условие' : 'Открыть текст'} open={resource.id === opened || undefined}>
            <MaterialText resource={resource} />
            {resource.translation && <Fold title="Перевод на русский"><p className="source-text" lang="ru">{resource.translation}</p></Fold>}
          </Fold>}
          {resource.story && <><StoryVersions story={resource.story} language={resource.language} /><Fold title="Первая голосовая попытка"><Recording itemId={resource.id} language={resource.language} readOnly /></Fold></>}
          <div className="actions">
            <button className="primary" type="button" onClick={() => practice(resource.id)}>{kind.action}</button>
            <button type="button" onClick={() => {
              setEditing(resource); reset(value => value + 1);
              show('edit');
            }}>Изменить</button>
            <button type="button" onClick={() => { setSource(resource); show('import'); }}>Подготовить запрос для ИИ</button>
            <button type="button" onClick={() => { setDeleting(resource); show('archive'); }}>Удалить</button>
          </div>
        </article>;
      })}</div>
    </div>
  </>;
}
