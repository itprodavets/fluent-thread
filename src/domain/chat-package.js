const materialKinds = new Set(['reading', 'exercise', 'dialogue', 'media']);

function field(value, label, limit, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) {
    throw new Error('Проверь поле «' + label + '» в файле.');
  }
  return value.trim();
}

function list(value, label, limit) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > limit || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Проверь список «' + label + '» в файле.');
  }
  return value;
}

export function safeSourceUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Invalid URLs are rejected before saving. */ }
  return '';
}

export function buildChatPrompt(language, topic = '', source) {
  const schema = chatPackageExample(language, topic);
  const subject = source
    ? '\nИспользуй следующий материал из моего занятия:\n' + JSON.stringify(source, null, 2)
    : '\nВозьми мои реальные реплики и контекст из текущего голосового или текстового разговора. Если реплики недоступны, попроси меня вставить расшифровку.';
  return 'Подготовь файл nit-rechi.json для импорта в «Нить речи».' + subject +
    '\nВыбери одну конкретную ситуацию. Исправь мои формулировки, сохрани смысл. Предполагаемые реплики собеседника пометь как учебную реконструкцию. Составь связный диалог с началом, уточнениями и завершением. Выдели до 12 полезных выражений с переводом и примерами. Добавь 2–3 задания: понимание диалога и собственный ответ. У каждого задания укажи условие и ответ для сверки. Используй язык, формат и версию из примера. Верни только JSON или файл, без пояснений вокруг JSON.\n\n' +
    JSON.stringify(schema, null, 2);
}

export function chatPackageExample(language, topic = '') {
  return {
    format: 'nit-rechi',
    version: 1,
    language,
    topic: { title: topic || 'Название темы', prompt: 'Что предложить сказать вслух' },
    words: [{ title: 'слово или выражение', meaning: 'значение на русском', example: 'пример на изучаемом языке' }],
    materials: [
      { kind: 'exercise', title: 'Задание', prompt: 'Условие упражнения', answer: 'Пример ответа на изучаемом языке' },
      { kind: 'dialogue', title: 'Диалог', text: 'Имя: реплика\nИмя: ответ', translation: 'Перевод диалога на русский' }
    ]
  };
}

export function parseChatPackage(text) {
  if (text.length > 1_000_000) throw new Error('Файл должен быть меньше 1 МБ.');
  const input = text.replace(/^\uFEFF/, '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  let data;
  try { data = JSON.parse(input); }
  catch { throw new Error('Не удалось прочитать JSON. Скопируй пакет целиком.'); }
  if (data?.format !== 'nit-rechi' || data.version !== 1) {
    throw new Error('Нужен пакет «Нить речи» версии 1. Скопируй команду для чата из приложения.');
  }
  let language;
  try { [language] = Intl.getCanonicalLocales(field(data.language, 'language', 35, true)); }
  catch { throw new Error('Укажи корректный код языка в поле language.'); }
  const topic = {
    title: field(data.topic?.title, 'topic.title', 90, true),
    prompt: field(data.topic?.prompt, 'topic.prompt', 4000)
  };
  const words = list(data.words, 'words', 150).map(word => ({
    title: field(word.title, 'word.title', 300, true),
    meaning: field(word.meaning, 'word.meaning', 2000),
    example: field(word.example, 'word.example', 8000)
  }));
  const materials = list(data.materials, 'materials', 60).map(material => {
    if (!materialKinds.has(material.kind)) throw new Error('Неизвестный тип материала.');
    const title = field(material.title, 'material.title', 120, true);
    const text = field(material.text, 'material.text', 250000);
    const translation = field(material.translation, 'material.translation', 250000);
    const prompt = field(material.prompt, 'material.prompt', 4000);
    const answer = field(material.answer, 'material.answer', 12000);
    const originalUrl = field(material.url, 'material.url', 2000);
    const url = safeSourceUrl(originalUrl);
    if (originalUrl && !url) throw new Error('Ссылка на источник должна начинаться с https:// или http://.');
    if (!text && !url && !(material.kind === 'exercise' && prompt)) {
      throw new Error('В материале «' + title + '» нет текста, ссылки или условия.');
    }
    return { kind: material.kind, title, text, ...(translation ? { translation } : {}), prompt, answer: material.kind === 'exercise' ? answer : '', url };
  });
  if (!words.length && !materials.length) throw new Error('В пакете нет слов и материалов.');
  return { language, topic, words, materials };
}

export function applyChatPackage(study, packet, topicId) {
  const { language } = packet;
  const normalize = value => (value ?? '').normalize('NFC').trim().toLocaleLowerCase(language);
  const next = {
    ...study,
    words: [...study.words],
    topics: [...study.topics],
    resources: [...study.resources]
  };
  const available = next.topics.filter(topic => topic.language === language);
  const existing = topicId
    ? available.find(topic => topic.id === topicId)
    : available.find(topic => normalize(topic.title) === normalize(packet.topic.title));
  if (topicId && !existing) throw new Error('Выбранная тема больше недоступна.');
  const topic = existing
    ? { ...existing, links: [...existing.links] }
    : { id: crypto.randomUUID(), language, ...packet.topic, links: [], materials: [] };
  const linked = new Set(topic.links);
  let wordsAdded = 0;
  for (const entry of packet.words) {
    const candidates = next.words.filter(word => word.language === language && normalize(word.title) === normalize(entry.title));
    let word = candidates.find(candidate => normalize(candidate.meaning) === normalize(entry.meaning));
    if (!word && candidates.length === 1 && (!candidates[0].meaning || !entry.meaning)) [word] = candidates;
    if (!word) {
      const id = JSON.stringify([language, 'word', normalize(entry.title), normalize(entry.meaning)]);
      word = { id, language, ...entry };
      next.words.push(word);
      wordsAdded += 1;
    } else if (entry.example && entry.example !== word.example && !word.chatExamples?.includes(entry.example)) {
      const index = next.words.indexOf(word);
      word = { ...word, chatExamples: [...(word.chatExamples ?? []), entry.example] };
      next.words[index] = word;
    }
    linked.add(word.id);
  }
  topic.links = [...linked];
  if (existing) next.topics[next.topics.indexOf(existing)] = topic;
  else next.topics.push(topic);

  const resourceKey = entry => JSON.stringify([entry.kind, normalize(entry.title), entry.text ?? '', entry.prompt ?? '', entry.answer ?? '', entry.url ?? '', entry.translation ?? '']);
  const present = new Map(next.resources.filter(entry => entry.topicId === topic.id).map(entry => [resourceKey(entry), entry]));
  const packageEntries = [];
  let materialsAdded = 0;
  const imported = [];
  for (const material of packet.materials) {
    const key = resourceKey(material);
    const existing = present.get(key);
    if (existing) { packageEntries.push(existing); continue; }
    const entry = { id: crypto.randomUUID(), language, topicId: topic.id, ...material };
    next.resources.push(entry);
    imported.push({ id: entry.id, content: materialContent(entry) });
    present.set(key, entry);
    packageEntries.push(entry);
    materialsAdded += 1;
  }
  if (imported.length) next.topicPackageMaterials = { ...study.topicPackageMaterials, [topic.id]: [...(study.topicPackageMaterials?.[topic.id] ?? []), ...imported] };
  if (packageEntries.some(entry => entry.kind === 'dialogue' && entry.text)) {
    const resourceIds = [...new Set(packageEntries.map(entry => entry.id))];
    const groups = next.importedLessons ?? [];
    if (!groups.some(group => group.topicId === topic.id && group.resourceIds.length === resourceIds.length && resourceIds.every(id => group.resourceIds.includes(id)))) {
      next.importedLessons = [...groups, { id: crypto.randomUUID(), topicId: topic.id, title: packet.topic.title, resourceIds }];
    }
  }
  return { next, topic, wordsAdded, materialsAdded };
}

const materialContent = entry => JSON.stringify([entry.kind, entry.title, entry.text ?? '', entry.prompt ?? '', entry.answer ?? '', entry.url ?? '', entry.translation ?? '']);

/** @returns {{id: string, title: string, selected: boolean}[]} */
export function topicImportPreview(study, topicId) {
  const previous = new Map((study.topicPackageMaterials?.[topicId] ?? []).map(entry => [entry.id, entry.content]));
  return study.resources.filter(entry => entry.topicId === topicId).map(entry => ({
    id: entry.id,
    title: entry.title,
    selected: previous.get(entry.id) === materialContent(entry)
  }));
}

export function replaceTopicPackage(study, packet, topicId, approved, now = Date.now()) {
  const byId = new Map(approved.map(entry => [entry.id, entry.content]));
  const incoming = new Set(packet.materials.map(materialContent));
  const archived = study.resources.filter(entry => entry.topicId === topicId &&
    byId.get(entry.id) === materialContent(entry) && !incoming.has(materialContent(entry)));
  const hidden = new Set(archived.map(entry => entry.id));
  const result = applyChatPackage({ ...study, resources: study.resources.filter(entry => !hidden.has(entry.id)) }, packet, topicId);
  const previous = new Set(study.resources.map(entry => entry.id));
  const known = new Map((study.topicPackageMaterials?.[topicId] ?? []).map(entry => [entry.id, entry.content]));
  const managed = result.next.resources.filter(entry => entry.topicId === topicId && incoming.has(materialContent(entry))
    && (!previous.has(entry.id) || byId.has(entry.id) || known.get(entry.id) === materialContent(entry)));
  return { ...result, archived: archived.length, next: {
    ...result.next,
    topicPackageMaterials: { ...study.topicPackageMaterials, [topicId]: managed.map(entry => ({ id: entry.id, content: materialContent(entry) })) },
    materialArchives: archived.length ? [...(study.materialArchives ?? []), { id: crypto.randomUUID(), topicId, at: now, entries: archived }] : study.materialArchives
  } };
}

/** @returns {{id: string, content: string}[]} */
export function approveTopicMaterials(study, topicId, ids) {
  const selected = new Set(ids);
  return study.resources.filter(entry => entry.topicId === topicId && selected.has(entry.id))
    .map(entry => ({ id: entry.id, content: materialContent(entry) }));
}

export function restoreMaterialArchive(study, archiveId) {
  const batch = study.materialArchives?.find(entry => entry.id === archiveId);
  if (!batch) return study;
  const active = new Set(study.resources.map(entry => entry.id));
  return {
    ...study,
    resources: [...study.resources, ...batch.entries.filter(entry => !active.has(entry.id))],
    materialArchives: study.materialArchives.filter(entry => entry.id !== archiveId)
  };
}

export function archiveMaterial(study, id, now = Date.now()) {
  const entry = study.resources.find(item => item.id === id);
  if (!entry) return study;
  return {
    ...study,
    resources: study.resources.filter(item => item.id !== id),
    materialArchives: [...(study.materialArchives ?? []), { id: crypto.randomUUID(), topicId: entry.topicId, at: now, entries: [entry] }]
  };
}
