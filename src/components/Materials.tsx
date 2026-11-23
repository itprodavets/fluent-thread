import { parseMaterialRoute, resolveMaterialRoute } from '../domain/material-route';
import { MaterialReview } from './MaterialReview';
import { materialLibraryPage } from '../domain/material-library';
import { ownedKey } from '../domain/profile-local';
import { bundledLessons } from '../domain/bundled-lessons';
import { ReadingShelf } from './ReadingShelf';
import { ReadableMaterial } from './ReadableMaterial';
import { dialogueChoices, importedLessonsFor } from '../domain/imported-lessons';
import { starterLessons, starterScenes } from '../domain/starter-materials';
import { isStarterResource } from '../domain/starter-materials';
import { LessonTranscript } from './LessonTranscript';
import { LessonPractice, LessonVocabulary, PhraseRecall } from './LessonPractice';
import { PhraseTopics } from './PhraseTopics';
import { SchoolLessonPicker } from './SchoolLessonPicker';
import { DialogueMistakeReview } from './DialogueMistakeReview';
import { dialogueMistakesHash } from '../domain/dialogue-mistakes';
import { SkillReply } from './SkillReply';
import { SkillPicker } from './SkillPicker';
import { skillMatches, skillPhraseCards } from '../domain/skill-dialogues';
import datedLessons from '../../materials/en/lessons/catalog.json';
import { lessonSource } from '../domain/school-lessons';
import skills from '../../materials/en/skills/catalog.json';
import { lessonPhrasesHash, phraseReviews, skillPhrasesHash } from '../domain/lesson-practice';
import { lessonCues, lessonTopicTitle } from '../domain/lesson-cues';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useWorkspace } from '../context';
import { applyChatPackage, archiveMaterial, approveTopicMaterials, replaceTopicPackage, restoreMaterialArchive, topicImportPreview, buildChatPrompt, chatPackageExample, parseChatPackage, safeSourceUrl } from '../domain/chat-package.js';
import { languageCodes, LanguageLabel } from './Language';
import { suggestMaterialLanguage } from '../domain/language-detection';
import { kinds, languageName, selectLanguage, upsert } from '../domain/model';
import type { MaterialKind, Resource } from '../domain/model';
import { Recording } from './Recording';
import { StoryVersions } from './StoryVersions';
import { StarterLesson, StarterMaterials, TeacherReadingCard } from './StarterMaterials';
import { copyText, Fold, Heading, SourceLink, VoiceButtons } from './common';


type RecentLesson = { scene: string; dialogue: string };
function readRecent(key: string): RecentLesson[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(data) ? data.filter(item =>
      typeof item?.scene === 'string' && typeof item?.dialogue === 'string').slice(0, 8) : [];
  } catch { return []; }
}

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

function ChatExchange({ source, setSource, onImported }: { source?: Resource; setSource: (resource?: Resource) => void; onImported: (topicId: string, hasDialogue: boolean) => void }) {
  const { study, active, notify, update } = useWorkspace();
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
      if (saved) { setPreview(undefined); notify(`Тема обновлена. В архиве: ${archived}.`); onImported(preview.topicId, preview.packet.materials.some(item => item.kind === 'dialogue')); }
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
        onImported(result.topic.id, packet.materials.some(item => item.kind === 'dialogue'));
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Не удалось импортировать пакет.'); }
    finally { setBusy(false); }
  }
  return <>
    <form onSubmit={submit} hidden={!!preview}>
      <p className="sub">Выбери файл Fluent Thread или вставь JSON. Для замены старой версии выбери режим обновления.</p>
      {source && <div className="actions"><span>{source.title}</span><button type="button" onClick={() => { setSource(undefined); setCommand(''); }}>Убрать материал</button></div>}
      <label>Куда добавить <TopicSelect value={selected} change={setTarget} fallback="Тема из файла" /></label>
      <section className="import-guide">
        <h3>Подготовить материалы из разговора</h3>
        <p>Вставь запрос в тот же чат после голосовой или текстовой практики. Затем загрузи ответ сюда.</p>
        <div className="actions">
          <button type="button" onClick={prepare}>Скопировать запрос для ИИ</button>
          <button type="button" onClick={() => void copyText(JSON.stringify(chatPackageExample(study.language), null, 2), notify)}>Скопировать пример JSON</button>
        </div>
        <Fold title="Формат файла · Fluent Thread v1"><pre className="package-example">{JSON.stringify(chatPackageExample(study.language), null, 2)}</pre></Fold>
      </section>
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

function MaterialText({ resource, full = false }: { resource: Resource; full?: boolean }) {
  return <><MaterialContent resource={resource} full={full} /><MaterialReview resource={resource} /></>;
}

function LibraryText({ resource, initiallyOpen }: { resource: Resource; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => { if (initiallyOpen) setOpen(true); }, [initiallyOpen]);
  return <details className="fold" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{resource.kind === 'exercise' ? 'Читать условие' : 'Открыть текст'}</summary>
    {open && <MaterialContent resource={resource} />}
  </details>;
}

function MaterialContent({ resource, full = false }: { resource: Resource; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const cues = lessonCues(resource.text);
  if (!cues.length) return <><ReadableMaterial text={resource.text} language={resource.language} translation={resource.translation} dialogue={resource.kind === 'dialogue'} /><VoiceButtons text={resource.text} language={resource.language} /></>;
  const transcript = <LessonTranscript cues={cues} recordingKey={resource.text.match(/^Recording: (lesson-[a-z0-9-]+)$/m)?.[1] ?? resource.topicId ?? resource.id}
    language={resource.language} topicId={resource.topicId} full={full} />;
  if (full) return transcript;
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Расшифровка · фрагменты ({cues.length})</summary>
    {open && transcript}
  </details>;
}

function MaterialChoices({ title, options, selected, choose, collapsible }: {
  title: string; options: { id: string; title: string }[]; selected: string;
  choose: (id: string) => void; collapsible?: boolean;
}) {
  const buttons = <div className="material-choice-grid" role="group" aria-label={title}>
    {options.map(option => <button type="button" key={option.id}
      aria-pressed={option.id === selected} onClick={() => choose(option.id)}>{option.title}</button>)}
  </div>;
  return collapsible ? <Fold title={title}>{buttons}</Fold>
    : <section className="material-choices"><h2>{title}</h2>{buttons}</section>;
}

export function Materials() {
  const { active, resourceId, practice, study, update, notify } = useWorkspace();
  const [editing, setEditing] = useState<Resource>();
  const [source, setSource] = useState<Resource>();
  const [opened, setOpened] = useState(resourceId);
  const [revision, reset] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const lessonNavigation = useRef<HTMLDialogElement>(null);
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const lessonWorkArea = useRef<HTMLDivElement>(null);
  const skillPractice = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<'edit' | 'import' | 'archive'>();
  const [view, setView] = useState<'lessons' | 'reading' | 'library' | 'questions' | 'phrases' | 'mistakes'>(() => {
    if (location.hash.startsWith('#materials/lesson/')) return 'lessons';
    if (location.hash === '#materials/reading') return 'reading';
    if (location.hash === dialogueMistakesHash) return 'mistakes';
    if (location.hash === lessonPhrasesHash) return 'phrases';
    if (['#materials/audio', '#materials/questions'].includes(location.hash) && study.language === 'en') return 'questions';
    return location.hash === '#materials/library' || resourceId ? 'library' : 'lessons';
  });
  const route = parseMaterialRoute(location.hash);
  const routeSelection = route && resolveMaterialRoute(study, route, skills, datedLessons);
  const [routeActive, setRouteActive] = useState(!!route);
  const [catalog, setCatalog] = useState<'schools' | 'skills'>(() => location.hash === skillPhrasesHash || routeSelection?.skillId ? 'skills' : 'schools');
  const [skillId, setSkill] = useState(() => routeSelection?.skillId ?? skills.find(item =>
    phraseReviews(study, item.dialogues.flatMap(dialogue => dialogue.phrases), Date.now()).due.size)?.id ?? skills[0].id);
  const recentKey = ownedKey('nit-rechi:recent-lessons:' + study.language);
  const [recent, setRecent] = useState(() => readRecent(recentKey));
  const [scene, setScene] = useState(route ? routeSelection?.topicId ?? '' : recent[0]?.scene ?? '');
  const [lessonId, setLessonId] = useState(route ? routeSelection?.resourceId ?? '' : recent[0]?.dialogue ?? '');
  const [picker, setPicker] = useState<'recent' | 'schools' | 'skills'>(
    location.hash === skillPhrasesHash ? 'skills' : 'schools');
  const [browseSkill, setBrowseSkill] = useState(skillId);
  const [lessonQuery, setLessonQuery] = useState('');
  const routedTopic = routeSelection?.topicId;
  const routedResource = routeSelection?.resourceId;
  const routedSkill = routeSelection?.skillId;
  useEffect(() => {
    if (!routeActive) return;
    // Cloud hydration can supply the route target after this screen has mounted.
    // Primitive dependencies avoid resetting an explicit level on assessment updates.
    setScene(routedTopic ?? '');
    setLessonId(routedResource ?? '');
    setCatalog(routedSkill ? 'skills' : 'schools');
    if (routedSkill) { setSkill(routedSkill); setBrowseSkill(routedSkill); }
  }, [routeActive, routedTopic, routedResource, routedSkill]);
  const lessons = useMemo(() => importedLessonsFor(study), [study]);
  const lessonTopics = useMemo(() => active.topics.filter(topic => lessons.some(lesson => lesson.topicId === topic.id)), [active.topics, lessons]);
  const dialoguesByTopic = useMemo(() => new Map(lessonTopics.map(topic => [
    topic.id, dialogueChoices(lessons.filter(item => item.topicId === topic.id)).map(choice =>
      ({ id: (choice.versions.find(version => version.level === 'B2') ?? choice.versions[0]).id, title: choice.title }))
  ])), [lessonTopics, lessons]);
  const skill = skills.find(entry => entry.id === skillId) ?? skills[0];
  const skillDialogs = catalog === 'skills' ? skillMatches(skill, lessonTopics, datedLessons, dialoguesByTopic) : [];
  const skillDialogue = skillDialogs.find(entry => entry.topicId === scene && lessons.some(lesson => lesson.id === lessonId
    && lesson.topicId === entry.topicId && lesson.title === entry.title)) ?? skillDialogs[0];
  const skillCards = skillPhraseCards(skillDialogs, skillDialogue);
  const selectedScene = routeActive ? scene : catalog === 'skills' ? skillDialogue?.topicId ?? '' :
    [...lessonTopics, ...(study.language === 'en' ? starterScenes : [])].some(topic => topic.id === scene)
      ? scene : lessonTopics[0]?.id ?? (study.language === 'en' ? starterScenes[0].id : '');
  const choices = dialogueChoices(lessons.filter(item => item.topicId === selectedScene));
  const selectedChoice = choices.find(choice => catalog === 'skills' ? choice.title === skillDialogue?.title
    : choice.versions.some(version => version.id === lessonId)) ?? choices[0];
  const selectedLesson = selectedChoice?.versions.find(version => version.id === lessonId)
    ?? selectedChoice?.versions.find(version => version.level === 'B2') ?? selectedChoice?.versions[0];
  useEffect(() => {
    if (location.hash === skillPhrasesHash && !lessonNavigation.current?.open) lessonNavigation.current?.showModal();
  }, []);
  const [filter, setFilter] = useState('');
  const [libraryPage, setLibraryPage] = useState(0);
  const [deleting, setDeleting] = useState<Resource>();
  const [busy, setBusy] = useState(false);
  const materials = active.resources.filter(resource => !isStarterResource(resource.id));
  const library = materialLibraryPage(materials, filter, libraryPage, opened);
  const currentTopic = active.topics.find(topic => topic.id === selectedScene);
  const starter = study.language === 'en' && starterScenes.find(item => item.id === selectedScene);
  const starterLevel = starterLessons.find(item => item.sceneId === selectedScene && item.resource.id === lessonId)?.level ?? 'A1';
  const currentTitle = selectedChoice?.title ?? (starter ? starter.title : currentTopic?.title);
  const recentTitles = new Set<string>();
  const recentChoices = recent.flatMap(entry => {
    const topic = lessonTopics.find(item => item.id === entry.scene);
    const dialogue = lessons.find(item => item.id === entry.dialogue && item.topicId === entry.scene);
    const starterTopic = study.language === 'en' && starterScenes.find(item => item.id === entry.scene);
    const key = entry.scene + ':' + (dialogue?.title ?? '');
    if (!dialogue && !starterTopic) return [];
    if (recentTitles.has(key)) return [];
    recentTitles.add(key);
    return dialogue && topic ? [{ ...entry, title: dialogue.title, detail: topic.title }]
      : starterTopic ? [{ ...entry, title: starterTopic.title, detail: 'Стартовый диалог' }] : [];
  });
  function rememberLesson(scene: string, dialogue: string) {
    const next = [{ scene, dialogue }, ...recent.filter(item => item.scene !== scene || item.dialogue !== dialogue)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }
  const browsingSkill = skills.find(item => item.id === browseSkill) ?? skills[0];
  const starterResults = starterScenes.filter(item => item.title.toLocaleLowerCase().includes(lessonQuery.trim().toLocaleLowerCase()));
  function show(value: NonNullable<typeof panel>) {
    setPanel(value);
    if (!dialog.current?.open) dialog.current?.showModal();
  }
  const missingLessons = bundledLessons.filter(item => item.language === study.language &&
    !active.topics.some(topic => topic.title === item.title));
  const [loadingLessons, setLoadingLessons] = useState(false);
  async function loadLessons() {
    if (loadingLessons) return;
    setLoadingLessons(true);
    try {
      const packets = await Promise.all(missingLessons.map(async item => parseChatPackage((await item.load()).default)));
      await update(current => packets.reduce((next, packet) =>
        next.topics.some(topic => topic.language === packet.language && topic.title === packet.topic.title)
          ? next : applyChatPackage(next, packet).next, current));
    } catch {
      notify('Не удалось загрузить материалы. Попробуй ещё раз.');
    } finally {
      setLoadingLessons(false);
    }
  }
  const loadButton = !!missingLessons.length && <button type="button" disabled={loadingLessons} onClick={() => void loadLessons()}>
    {loadingLessons ? 'Загружаем уроки…' : 'Добавить готовые уроки'}
  </button>;
  function changeView(next: 'lessons' | 'reading' | 'library' | 'questions') {
    const hash = next === 'lessons' ? '#materials' : '#materials/' + next;
    if (location.hash !== hash) location.hash = hash;
    else setView(next);
  }
  function openReadingLesson(topic: string, dialogue = '') {
    chooseTopic(topic, dialogue);
    changeView('lessons');
  }
  function showPicker() {
    setLessonQuery('');
    setPicker(location.hash === skillPhrasesHash ? 'skills' : recentChoices.length ? 'recent' : 'schools');
    if (location.hash === skillPhrasesHash) setBrowseSkill(skillId);
    lessonNavigation.current?.showModal();
  }
  function chooseTopic(id: string, dialogueId = '', mode: 'schools' | 'skills' = 'schools') {
    setRouteActive(false);
    setCatalog(mode);
    setScene(id);
    setLessonId(dialogueId);
    rememberLesson(id, dialogueId || dialoguesByTopic.get(id)?.[0]?.id || '');
    lessonNavigation.current?.close();
    requestAnimationFrame(() => {
      lessonWorkArea.current?.scrollIntoView({ block: 'start' });
      lessonHeading.current?.focus({ preventScroll: true });
    });
  }
  function close() { dialog.current?.close(); }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try { if (await update(current => archiveMaterial(current, deleting.id))) close(); }
    finally { setBusy(false); }
  }
  return <>{(route?.fromMap || location.hash === '#materials/map') && <a className="back-to-today" href="#map">← Вернуться к списку на карте</a>}<Heading title="Материалы" detail="Тексты, упражнения и записи для разговорной практики." />
    <div className="library">
      <nav className="account-sections" aria-label="Разделы материалов">
        <button type="button" aria-pressed={view === 'lessons'} onClick={() => changeView('lessons')}>Занятия</button>
        <button type="button" aria-pressed={view === 'reading'} onClick={() => changeView('reading')}>Читать</button>
        <a className="button" aria-current={view === 'phrases' ? 'page' : undefined} href={lessonPhrasesHash} onClick={() => setView('phrases')}>Фразы и грамматика</a>
        {study.language === 'en' && <a className="button" aria-current={view === 'mistakes' ? 'page' : undefined} href={dialogueMistakesHash} onClick={() => setView('mistakes')}>Мои ошибки</a>}
        <button type="button" aria-pressed={view === 'library'} onClick={() => changeView('library')}>Библиотека</button>
        {study.language === 'en' && <button type="button" aria-pressed={view === 'questions'} onClick={() => changeView('questions')}>Вопросы к уроку</button>}
      </nav>
      {view === 'library' && <MaterialChoices title="Тема библиотеки" selected={filter} choose={id => { setFilter(id); setOpened(undefined); setLibraryPage(0); }}
        options={[{ id: '', title: 'Все темы' }, ...active.topics, { id: 'unassigned', title: 'Без темы' }]} />}
      {view === 'lessons' && <div className="lesson-workspace">
        <div className="resource lesson-toolbar">
          <div>
            <p className="sub">Текущее занятие</p>
            <h2 ref={lessonHeading} tabIndex={-1}>{currentTitle ?? 'Занятия'}</h2>
            {currentTopic && <p className="sub">{lessonSource(currentTopic, datedLessons)?.school ?? currentTopic.title}</p>}
          </div>
          <button type="button" className="primary" onClick={showPicker}>Выбрать занятие</button>
        </div>
        {routeActive && routeSelection?.notice && <p className="sub" role="status">{routeSelection.notice}</p>}
        <dialog ref={lessonNavigation} className="material-dialog lesson-picker" aria-labelledby="lesson-picker-title">
          <header className="actions"><h2 id="lesson-picker-title">Выбор занятия</h2>
            <button type="button" onClick={() => lessonNavigation.current?.close()}>Закрыть</button>
          </header>
          <div className="lesson-picker-body">
            <div className="practice-modes" role="group" aria-label="Способ выбора занятия">
              <button type="button" aria-pressed={picker === 'recent'} onClick={() => setPicker('recent')}>Недавние</button>
              <button type="button" aria-pressed={picker === 'schools'} onClick={() => setPicker('schools')}>По школам</button>
              {study.language === 'en' && <button type="button" aria-pressed={picker === 'skills'} onClick={() => setPicker('skills')}>По навыкам</button>}
            </div>
            {picker === 'recent' && (recentChoices.length ? <div className="school-lesson-list">
              {recentChoices.map(entry => <button key={entry.scene + ':' + entry.dialogue} type="button" className="school-lesson-choice"
                onClick={() => chooseTopic(entry.scene, entry.dialogue)}>{entry.title}<small>{entry.detail}</small></button>)}
            </div> : <p className="sub">Здесь появятся занятия, которые ты открывал.</p>)}
            {picker === 'skills' && <SkillPicker skills={skills} selected={browsingSkill.id}
              matches={skillMatches(browsingSkill, lessonTopics, datedLessons, dialoguesByTopic)}
              selectedTopic={selectedScene} selectedDialogue={selectedChoice?.title}
              change={setBrowseSkill} open={entry => {
                setSkill(browsingSkill.id);
                chooseTopic(entry.topicId, entry.dialogueId, 'skills');
              }} />}
            {picker === 'schools' && <>
              <label>Найти школу, занятие или диалог
                <input type="search" value={lessonQuery} onChange={event => setLessonQuery(event.target.value)} />
              </label>
              {loadButton}
              {!!lessonTopics.length && <SchoolLessonPicker topics={lessonTopics} selected={selectedScene}
                choose={chooseTopic} dialogues={dialoguesByTopic} search={lessonQuery} compact />}
              {study.language === 'en' && !!starterResults.length && <MaterialChoices title="Стартовые темы"
                selected={selectedScene} choose={chooseTopic} options={starterResults} collapsible={!lessonQuery.trim() && !!lessonTopics.length} />}
            </>}
          </div>
        </dialog>
        <div ref={lessonWorkArea} className="lesson-work-area">
          {catalog === 'schools' && choices.length > 1 && selectedChoice && <div className="lesson-dialogue-select">
            <label>Диалог в занятии<select value={selectedChoice.versions[0].id} onChange={event => {
              const versions = choices.find(choice => choice.versions[0].id === event.target.value)?.versions;
              const version = versions?.find(item => item.level === selectedLesson?.level)
                ?? versions?.find(item => item.level === 'B2') ?? versions?.[0];
              if (version) {
                setRouteActive(false);
                setLessonId(version.id);
                rememberLesson(selectedScene, version.id);
              }
            }}>{choices.map(choice => <option key={choice.versions[0].id} value={choice.versions[0].id}>{choice.title}</option>)}</select></label>
          </div>}
          {catalog === 'schools' && study.language === 'en' && starterScenes.some(item => item.id === selectedScene)
            ? <StarterMaterials scene={selectedScene} chooseScene={chooseTopic} level={starterLevel} chooseLevel={level => {
              const version = starterLessons.find(item => item.sceneId === selectedScene && item.level === level);
              if (version) {
                setRouteActive(false);
                setLessonId(version.resource.id);
                rememberLesson(selectedScene, version.resource.id);
              }
            }} />
            : selectedLesson && selectedChoice ? <>
              <div className="lesson-work-header">
                {skillDialogue && <div className="actions">
                  <p className="sub">{skill.title} · {skillDialogue.school}</p>
                  <button type="button" onClick={() => { skillPractice.current?.scrollIntoView({ block: 'start' }); skillPractice.current?.focus({ preventScroll: true }); }}>
                    Учить фразы · {skillCards.length}
                  </button>
                </div>}
                {!!selectedLesson.level && <div className="level-tabs" role="group" aria-label="Уровень диалога">
                  {selectedChoice.versions.map(version => <button type="button" key={version.id}
                    aria-pressed={version.id === selectedLesson.id} onClick={() => {
                      setRouteActive(false);
                      setScene(selectedScene);
                      setLessonId(version.id);
                      rememberLesson(selectedScene, version.id);
                    }}>{version.level}</button>)}
                </div>}
              </div>
              <LessonVocabulary key={"vocabulary:" + selectedScene} topicId={selectedScene} />
              <StarterLesson key={selectedLesson.id + (skillDialogue ? skill.id : '')}
                lesson={{ ...selectedLesson, notes: [], source: skillDialogue ? '' : 'Диалог и задания из твоих материалов.' }}
                firstExercise={skillDialogue ? <SkillReply exercise={{ ...skillDialogue, skillId: skill.id }}
                  recordingId={`skill:${skill.id}:${selectedLesson.id}`} /> : undefined} />
              {skillDialogue && <section ref={skillPractice} tabIndex={-1} className="resource lesson-practice" aria-label="Фразы навыка">
                <h3>Фразы навыка</h3>
                <PhraseRecall key={skill.id + ':' + skillDialogue.dialogueId} cards={skillCards} language={study.language} />
              </section>}
              {materials.filter(item => item.topicId === selectedScene && item.title === 'Запись урока с таймкодами').map(item =>
                <section className="resource" key={item.id}>
                  <h3>Расшифровка урока с таймкодами</h3>
                  <MaterialText resource={item} />
                </section>)}
              {materials.filter(item => item.topicId === selectedScene && item.title.startsWith('Разбор записи ·')).map(item =>
                <Fold title={item.title} key={item.id}><MaterialText resource={item} /></Fold>)}
              <LessonPractice key={"practice:" + selectedScene} resources={active.resources} topicId={selectedScene} />
            </> : catalog === 'schools' && <p className="sub">Импортируй диалог с вопросами из чата, чтобы начать занятие.</p>}
        </div>
      </div>}
      {view === 'reading' && <ReadingShelf resources={materials} topics={active.topics} language={study.language} loadButton={loadButton}
        read={resource => <MaterialText key={resource.id} resource={resource} full />}
        openLesson={openReadingLesson}
        lessonTopics={lessonTopics} />}
      {view === 'mistakes' && <DialogueMistakeReview />}
      {view === 'phrases' && <PhraseTopics />}
      {view === 'questions' && study.language === 'en' && <TeacherReadingCard />}

      {view !== 'mistakes' && <Fold title="Управление материалами">
        <div className="actions">
          <button type="button" onClick={() => { setEditing(undefined); reset(n => n + 1); show('edit'); }}>Добавить материал</button>
          <button type="button" onClick={() => { setSource(undefined); show('import'); }}>Импорт из чата с ИИ</button>
        </div>
      </Fold>}

      <dialog ref={dialog} className="material-dialog" aria-labelledby="material-dialog-title" onClose={() => { setPanel(undefined); setDeleting(undefined); }}>
        <header className="actions">
          <h2 id="material-dialog-title">{panel === 'import' ? 'Импорт материалов' : panel === 'archive' ? 'Удалить из библиотеки' : editing ? 'Изменить материал' : 'Добавить материал'}</h2>
          <button type="button" onClick={close}>Закрыть</button>
        </header>
        {panel === 'edit' && <MaterialForm key={revision} resource={editing} done={id => { setOpened(id); setFilter(''); setView('library'); close(); }} />}
        {panel === 'import' && <ChatExchange key={source?.id ?? 'all'} source={source} setSource={setSource} onImported={(id, hasDialogue) => { setRouteActive(false); setScene(id); setLessonId(''); setFilter(id); setView(hasDialogue ? 'lessons' : 'library'); close(); }} />}
        {panel === 'archive' && deleting && <>
          <p>«{deleting.title}» переместится в архив. Его можно вернуть из раздела «Архив версий материалов».</p>
          <div className="actions"><button type="button" className="primary" disabled={busy} onClick={() => void remove()}>Переместить в архив</button><button type="button" onClick={close}>Отмена</button></div>
        </>}
      </dialog>
      {view === 'library' && <>
      {!!study.materialArchives?.length && <Fold title="Архив версий материалов">
        {study.materialArchives.map(batch => <div className="actions" key={batch.id}>
          <span>{study.topics.find(t => t.id === batch.topicId)?.title ?? 'Без темы'} · {batch.entries.map(entry => entry.title).join(', ')} · {new Date(batch.at).toLocaleString('ru')} · {batch.entries.length}</span>
          <button type="button" onClick={() => void update(current => restoreMaterialArchive(current, batch.id))}>Вернуть материалы</button>
        </div>)}
      </Fold>}
      <h2>Библиотека</h2>
      <p className="sub" role="status">Материалов: {library.total} · Страница {library.page + 1} / {library.pages}</p>
      <div className="library-list">{library.items.map(resource => {
        const kind = kinds[resource.kind];
        const topic = active.topics.find(entry => entry.id === resource.topicId);
        return <article key={resource.id} className="resource">
          <p className="kicker"><LanguageLabel code={resource.language} /> · {kind.label}{topic && ' · ' + topic.title}</p>
          <h2>{resource.title}</h2>
          <SourceLink url={resource.url} />
          <MaterialReview resource={resource} />
          {resource.text && <LibraryText resource={resource} initiallyOpen={resource.id === opened} />}
          {resource.story && <><StoryVersions story={resource.story} language={resource.language} /><Fold title="Первая голосовая попытка"><Recording itemId={resource.id} language={resource.language} readOnly /></Fold></>}
          <div className="actions">
            <button className="primary" type="button" onClick={() => practice(resource.id)}>{kind.action}</button>
            <button type="button" onClick={() => {
              setEditing(resource); reset(value => value + 1);
              show('edit');
            }}>Обновить</button>
            <button type="button" onClick={() => { setSource(resource); show('import'); }}>Подготовить запрос для ИИ</button>
            <button type="button" onClick={() => { setDeleting(resource); show('archive'); }}>Удалить</button>
          </div>
        </article>;
      })}</div>
      {library.pages > 1 && <div className="actions" aria-label="Страницы библиотеки"><button type="button" disabled={library.page === 0} onClick={() => { setOpened(undefined); setLibraryPage(library.page - 1); }}>Назад</button><span>{library.page + 1} / {library.pages}</span><button type="button" disabled={library.page + 1 >= library.pages} onClick={() => { setOpened(undefined); setLibraryPage(library.page + 1); }}>Дальше</button></div>}
      </>}
    </div>
  </>;
}
