export type ConversationStep = { id: string; title: string; transition: string; dialogue: string };
export type ConversationRoute = { id: string; language: string; title: string; steps: ConversationStep[] };

export function parseConversationRoute(text: string, language: string): ConversationRoute {
  if (text.length > 400_000) throw new Error('Маршрут слишком большой.');
  const value = JSON.parse(text.trim().replace(/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i, '$1'));
  const field = (input: unknown, limit: number, required = true) => {
    if (typeof input !== 'string' || input.length > limit || (required && !input.trim())) {
      throw new Error('Проверь название, переходы и диалоги в JSON.');
    }
    return input.trim();
  };
  if (!Array.isArray(value?.steps) || !value.steps.length || value.steps.length > 30) {
    throw new Error('В маршруте должно быть от 1 до 30 событий.');
  }
  return {
    id: crypto.randomUUID(), language, title: field(value.title, 120),
    steps: value.steps.map((step: { title?: unknown; transition?: unknown; dialogue?: unknown }, index: number) => ({
      id: crypto.randomUUID(), title: field(step?.title, 120),
      transition: index ? field(step?.transition, 400) : '', dialogue: field(step?.dialogue, 12000)
    }))
  };
}

export function conversationRoutePrompt(situation: string, language: string) {
  return [
    'Преврати описанную ниже ситуацию в последовательность разговорных событий.',
    'Определи число событий по описанию. Если разговор один, оставь один шаг. Сохрани порядок и участников.',
    'Для каждого следующего события напиши короткий переход: что произошло между ним и предыдущим шагом и почему они связаны.',
    'В каждом шаге напиши полный естественный диалог с вопросами, ответами и реакциями. Если это собеседование, сохрани его формат.',
    'Исправляй фразы учащегося с сохранением смысла. Домыслы о репликах явно помечай как учебную реконструкцию. Не приписывай учащемуся события, которых нет в описании.',
    'Название, переходы и реплики напиши на языке ' + language + '. Верни только JSON такой структуры:',
    JSON.stringify({ title: 'Название ситуации', steps: [{ title: 'Событие', transition: '', dialogue: 'Имя: реплика\nИмя: ответ' }] }),
    'Описание ситуации:', situation
  ].join('\n');
}
