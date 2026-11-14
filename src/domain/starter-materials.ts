import type { Resource } from './model';

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = typeof levels[number];

type Lesson = {
  resource: Resource;
  glossary: ReadonlyMap<string, string>;
  questions: [string, string][];
};

function lesson(level: Level, title: string, turns: string[], translation: string[], prompt: string,
  words: [string, string][], questions: [string, string][]): Lesson {
  return {
    resource: {
      id: 'starter:en:' + level, title, text: turns.join('\n'), translation: translation.join('\n'),
      prompt, kind: 'dialogue', language: 'en', url: '', answer: ''
    },
    glossary: new Map(words),
    questions
  };
}

export const englishLessons: Record<Level, Lesson> = {
  A1: lesson('A1', 'Before English Class', [
    'Maya: Hi! I’m Maya. Are you new here?',
    'Alex: Yes, I am. I’m Alex. Nice to meet you.',
    'Maya: Nice to meet you, too. Where do you live?',
    'Alex: I live in Guangzhou. How about you?',
    'Maya: I live in London. Do you like Guangzhou?',
    'Alex: Yes. I like the food there.',
    'Maya: Oh, the teacher’s here. See you after class!',
    'Alex: See you!'
  ], [
    'Майя: Привет! Я Майя. Ты здесь впервые?',
    'Алекс: Да. Я Алекс. Приятно познакомиться.',
    'Майя: Мне тоже. Где ты живёшь?',
    'Алекс: В Гуанчжоу. А ты?',
    'Майя: В Лондоне. Тебе нравится Гуанчжоу?',
    'Алекс: Да. Мне нравится местная еда.',
    'Майя: О, преподаватель уже здесь. До встречи после урока!',
    'Алекс: До встречи!'
  ], 'Сыграй Алекса. Назови свой город, задай встречный вопрос и скажи, что тебе нравится в твоём городе.',
  [['nice to meet you', 'приятно познакомиться'], ['how about you', 'а ты?'], ['see you', 'до встречи']],
  [['Where does Alex live?', 'Alex lives in Guangzhou.'], ['Why do they stop talking?', 'The teacher has arrived.']]),

  A2: lesson('A2', 'Choosing a Place for Dinner', [
    'Maya: Shall we eat out tonight? There’s a restaurant by the river.',
    'Alex: That sounds nice. Is it expensive?',
    'Maya: A little. There’s also a small dumpling place near the station.',
    'Alex: Do they have anything without meat? Sam’s coming with us.',
    'Maya: Yes, they have mushroom dumplings. I tried them last week.',
    'Alex: Let’s go there, then. Shall I book a table for seven?',
    'Maya: Please do. I’ll let Sam know.'
  ], [
    'Майя: Поужинаем сегодня вне дома? У реки есть ресторан.',
    'Алекс: Звучит хорошо. Там дорого?',
    'Майя: Немного. Ещё есть маленькая пельменная у станции.',
    'Алекс: Там есть что-нибудь без мяса? Сэм идёт с нами.',
    'Майя: Да, есть пельмени с грибами. Я пробовала их на прошлой неделе.',
    'Алекс: Тогда пойдём туда. Заказать столик на семь?',
    'Майя: Да, пожалуйста. Я сообщу Сэму.'
  ], 'Сыграй Алекса. Сначала выбери место у реки. Узнав о потребностях друга, уточни меню и договорись о времени.',
  [['eat out', 'есть вне дома'], ['without meat', 'без мяса'], ['book a table', 'заказать столик']],
  [['Why does Alex ask about the menu?', 'Sam is coming, and Alex wants to make sure there is something without meat.'], ['What will Maya do?', 'She’ll let Sam know.']]),

  B1: lesson('B1', 'Getting Used to Early Classes', [
    'Maya: You look wide awake today. Have you always been a morning person?',
    'Alex: Not at all. I used to go to bed after midnight.',
    'Maya: What changed?',
    'Alex: I signed up for an early class. I’m used to getting up early now, but I still find it hard to go to bed earlier.',
    'Maya: What helped you get used to the new schedule?',
    'Alex: I stopped checking my phone in bed. And I still have a lie-in on Sundays.',
    'Maya: That sounds manageable. I might try it for a week.'
  ], [
    'Майя: Ты сегодня совсем не сонный. Всегда был жаворонком?',
    'Алекс: Вовсе нет. Раньше я ложился после полуночи.',
    'Майя: Что изменилось?',
    'Алекс: Я записался на утренний урок. Вставать рано уже привычно, но ложиться раньше всё ещё трудно.',
    'Майя: Что помогло тебе привыкнуть к новому расписанию?',
    'Алекс: Перестал смотреть в телефон в кровати. А по воскресеньям всё ещё сплю подольше.',
    'Майя: Звучит вполне посильно. Попробую так неделю.'
  ], 'Расскажи Майе про свою привычку: что делал раньше, к чему уже привык и что пока трудно.',
  [['used to', 'раньше делал'], ['get used to', 'привыкнуть'], ['have a lie-in', 'поспать подольше']],
  [['What prompted Alex to change his routine?', 'He signed up for an early class.'], ['What is Alex still finding difficult?', 'Going to bed earlier.']]),

  B2: lesson('B2', 'Checking the Task in a Group Lesson', [
    'Teacher: Read the two opinions on your own. Then compare your notes and pick one argument to present.',
    'Alex: Sorry, could I check something? Are we meant to agree on a position?',
    'Teacher: You can disagree. Just make sure you can explain why you chose your argument.',
    'Maya: In that case, I’d focus on the people who live in the city centre.',
    'Alex: Can I just add something? We should also think about shops that need deliveries.',
    'Maya: Good point. Should we present both concerns and suggest a compromise?',
    'Teacher: Yes. You have a few minutes to work out what you’ll say.'
  ], [
    'Преподаватель: Прочитайте два мнения самостоятельно. Затем сравните заметки и выберите аргумент для выступления.',
    'Алекс: Простите, можно уточнить? Нам нужно прийти к общей позиции?',
    'Преподаватель: Можете не соглашаться. Главное — объяснить, почему выбрали свой аргумент.',
    'Майя: Тогда я бы сосредоточилась на жителях центра.',
    'Алекс: Можно добавить? Надо также подумать о магазинах, которым нужны поставки.',
    'Майя: Хорошее замечание. Представим обе проблемы и предложим компромисс?',
    'Преподаватель: Да. У вас есть несколько минут, чтобы продумать выступление.'
  ], 'Сыграй Алекса. Своими словами уточни порядок задания, затем подхвати мысль Майи и предложи решение.',
  [['on your own', 'самостоятельно'], ['are we meant to', 'мы должны?'], ['work out', 'продумать']],
  [['What should students do before comparing notes?', 'Read the two opinions on their own.'], ['Do they have to agree?', 'No. They need to explain the argument they choose.']]),

  C1: lesson('C1', 'Making a Pedestrian Zone Work', [
    'Maya: I’d make the high street car-free. The traffic puts people off going there.',
    'Alex: I can see the appeal, but how would the smaller shops handle deliveries?',
    'Maya: We could allow vans in before nine. That would still leave most of the day clear.',
    'Alex: That might suit cafés, but some businesses can’t dictate when suppliers turn up.',
    'Maya: Then let’s test it on one block and offer exceptions where there’s a genuine need.',
    'Alex: I could support that, provided we ask residents and traders what changed for them.',
    'Maya: Agreed. We’ll propose a trial with a review after a month.'
  ], [
    'Майя: Я бы сделала главную улицу пешеходной. Из-за движения люди неохотно туда ходят.',
    'Алекс: Понимаю, чем это привлекательно, но как небольшие магазины получат поставки?',
    'Майя: Можно пускать фургоны до девяти. Большую часть дня улица всё равно будет свободной.',
    'Алекс: Кафе это может подойти, но некоторые магазины не могут диктовать поставщикам время.',
    'Майя: Тогда испытаем это на одном квартале и разрешим исключения при реальной необходимости.',
    'Алекс: Я могу поддержать это при условии, что мы спросим жителей и торговцев, что для них изменилось.',
    'Майя: Согласна. Предложим пробный период и подведём итоги через месяц.'
  ], 'Выбери одну роль. Признай сильный аргумент собеседника, назови ограничение его предложения и договорись об условиях пробного периода.',
  [['puts people off', 'отбивает у людей желание'], ['turn up', 'появляться, приезжать'], ['provided', 'при условии']],
  [['Why does Alex challenge the delivery window?', 'Some businesses cannot control when suppliers arrive.'], ['What makes the final proposal acceptable to Alex?', 'A limited trial and feedback from residents and traders.']]),

  C2: lesson('C2', 'Who Benefits from the Trial?', [
    'Maya: Footfall rose after the street closed to cars. I’d say the trial worked.',
    'Alex: It’s encouraging, but footfall alone may conceal who stopped coming.',
    'Maya: Fair point. Are you suggesting we discount the increase?',
    'Alex: I’d treat it as one piece of evidence. If people with limited mobility now have to make a long detour, the overall gain tells only part of the story.',
    'Maya: We could ask at the next public meeting, although that might draw the people who already find it easy to get here.',
    'Alex: Precisely. Let’s speak to those who rarely come in person and compare their accounts with the figures.',
    'Maya: Then we can defend keeping the scheme if we also address the barriers it introduced.',
    'Alex: Yes. Let’s write that condition into the recommendation.'
  ], [
    'Майя: После закрытия улицы для машин поток людей вырос. Я бы сказала, эксперимент удался.',
    'Алекс: Это обнадёживает, но по одному потоку не видно, кто перестал приходить.',
    'Майя: Справедливо. Предлагаешь не учитывать рост?',
    'Алекс: Я бы считал его одним из показателей. Если маломобильным людям теперь приходится идти в обход, общий рост показывает лишь часть картины.',
    'Майя: Можно спросить на следующем собрании, хотя туда скорее придут те, кому и так легко добраться.',
    'Алекс: Именно. Поговорим с теми, кто редко приходит лично, и сопоставим их рассказы с цифрами.',
    'Майя: Тогда мы сможем обосновать сохранение проекта, если устраним препятствия, которые он создал.',
    'Алекс: Да. Внесём это условие в рекомендацию.'
  ], 'Сыграй Майю. Начни с сильного аргумента в пользу проекта, затем уточни, какие данные изменят твоё решение. Согласуй условие, при котором проект стоит сохранить.',
  [['footfall', 'поток посетителей'], ['one piece of evidence', 'один из источников данных'], ['tells only part of the story', 'показывает лишь часть картины']],
  [['Why might a public meeting give a skewed picture?', 'It may mainly attract people who can already reach the area easily.'], ['What do they agree to include in the recommendation?', 'A commitment to address barriers introduced by the scheme if it is kept.']])
};
