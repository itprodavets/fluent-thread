import type { Resource } from './model';
import type { LessonScene, Pair } from './lesson-scene.ts';
import { extraScenes } from './extra-lesson-scenes.ts';

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = typeof levels[number];
const scenes: LessonScene[] = [
  { id: 'introduction', title: 'Meeting a Classmate', source: 'Урок 01:01, 12:39–13:22. Ты рассказал, откуда родом, где живёшь, на каких языках говоришь и что у тебя есть чайное сообщество.',
    task: 'Познакомься с участником урока. Расскажи о себе и подхвати одну деталь из его ответа встречным вопросом.',
    versions: {
      A1: [['Where are you from?', 'I’m from Russia.'], ['Do you live there now?', 'No, I live in Guangzhou, China.'], ['What languages do you speak?', 'I speak Russian, Chinese and English.'], ['What do you like?', 'I like tea. I’m part of a tea group.']],
      A2: [['Where are you joining us from today?', 'I’m joining from Guangzhou, but I’m from Russia.'], ['Do you speak Chinese there?', 'Yes, I do. I speak Russian and English, too.'], ['You mentioned tea. What do you do?', 'I’m part of a large group of people who like tea.'], ['Could you tell me more after class?', 'Of course. Let’s talk during the break.']],
      B1: [['I don’t think we’ve met. Where are you based?', 'I’m based in Guangzhou now, although I’m originally from Russia.'], ['Which languages do you speak?', 'I speak Russian, Chinese and English. What about you?'], ['I’m learning Chinese. You mentioned a tea community. What’s it about?', 'It brings together people who share an interest in tea.'], ['I’d love to hear more. Shall we talk during the break?', 'Absolutely. I’d like to hear what sparked your interest in Chinese, too.']],
      B2: [['When you say you’re from Russia, is that where you live now?', 'I’m originally from Russia, but I’m currently based in Guangzhou, China.'], ['Does that mean you speak both Russian and Chinese?', 'Yes, and English as well.'], ['You also mentioned a tea community. How would you describe it to someone new?', 'It’s a large community of tea enthusiasts. What brings us together is our interest in tea.'], ['Could we pick that up later? The lesson’s about to start.', 'Of course. I’d be happy to tell you more during the break.']],
      C1: [['I heard you say Russia and China. Have I got that right?', 'Yes. I’m originally from Russia, and Guangzhou is where I live now.'], ['Which languages would you say you speak?', 'Russian, Chinese and English. I live in Guangzhou, so Chinese is part of my daily life.'], ['And what did you mean by a tea community?', 'A fairly large group united by an interest in tea. We’re all interested in tea, and that gives us something to talk about.'], ['That gives me a clearer picture. Can we pick up the conversation later?', 'Certainly. I’d be interested to hear how you got into tea, too.']],
      C2: [['If you had half a minute to introduce yourself to this group, what would you lead with?', 'I’d say I’m originally from Russia and now based in Guangzhou. I speak Russian, Chinese and English, and I’m part of a large community of tea enthusiasts.'], ['Would you describe yourself primarily through the languages you speak?', 'I’d mention them as context. Tea gives us something concrete to talk about once the introductions are out of the way.'], ['What might someone misunderstand about the word “community”?', 'It can sound like a formal organisation. What I mean here is a group of people drawn together by a shared interest.'], ['That’s clear. Do you mind if I ask about tea after the lesson?', 'Please do. I’d much rather pick up a real conversation than leave it at a formal introduction.']]
    }},
  { id: 'restaurant', title: 'Choosing a Restaurant', source: 'Урок 17:17, около 10:35–12:56 и 40:45. Ты выбрал ресторан у воды по первому впечатлению, поставил качество еды на первое место и упомянул пельмени с говядиной и трюфелем.',
    task: 'Договорись с другом, где поужинать. Сначала объясни свой выбор, затем спроси, что важно для него, и предложи решение.',
    versions: {
      A1: [['Which restaurant do you like?', 'I like the one by the water.'], ['Is the view important to you?', 'Yes, but good food is more important.'], ['What do you like to eat?', 'I like beef and truffle dumplings.'], ['Can we check the menu before choosing?', 'Yes, let’s look.']],
      A2: [['Where shall we eat tonight?', 'I’d like to try the restaurant by the water. It looks nice.'], ['Would you go there just for the view?', 'No. Good food is the most important thing for me.'], ['What would you order?', 'I often have beef and truffle dumplings. Do they have them?'], ['Let’s check the menu before we decide.', 'Good idea. What would you like to eat?']],
      B1: [['Which place makes the best first impression?', 'Based on my first impression, I’d choose the restaurant by the water.'], ['Does the location matter more than the food?', 'No. Food quality is my top priority, but being near the water is a bonus.'], ['What do you usually order when you eat out?', 'I often have beef and truffle dumplings. What about you?'], ['I’d rather have something lighter. Can we check the menu?', 'Sure. Let’s make sure there’s something we both want.']],
      B2: [['You picked the place by the water straight away. What caught your eye?', 'The setting made a good first impression. That’s where I’d start, though food quality would decide it for me.'], ['Would you choose differently if we went with family?', 'I’d still care about the food, but I’d check what everyone wanted before choosing.'], ['Is there a dish you’d look for?', 'I often order beef and truffle dumplings, but I wouldn’t choose the whole restaurant on that basis.'], ['So shall we compare the menus before we book?', 'Yes. If the food looks equally good, I’d go with the place by the water.']],
      C1: [['You’ve mentioned first impressions and food quality. How do they fit together?', 'The waterfront setting is what draws me in. The quality of the food is what would make me choose it over another place.'], ['What if the setting is lovely but the menu looks ordinary?', 'Then I’d probably look elsewhere. A nice view adds to the evening, but I wouldn’t make it the deciding factor.'], ['Does that change when you’re deciding for a group?', 'I’d ask what everyone feels like eating. I often go for beef and truffle dumplings, but that’s my preference.'], ['Let’s give everyone two options, then.', 'Agreed. We can compare the menus first and keep the waterfront place on the shortlist.']],
      C2: [['Would you say the waterfront restaurant is the better choice, or simply the more appealing one at first glance?', 'At first glance, it’s the more appealing one. Calling it the better choice would depend on whether the food lives up to the setting.'], ['Could the setting actually be part of what makes the food experience better?', 'Certainly. I’m happy to count the setting as part of the experience. I’d still give food quality the greatest weight.'], ['How would you avoid imposing your preferences when choosing for friends?', 'I’d ask what they’re in the mood for. My fondness for beef and truffle dumplings is a starting point for discussion, not a reason to pick for everyone.'], ['Where does that leave us tonight?', 'Let’s agree on a shortlist from the menus. If two places are equally promising, I’d suggest the one by the water.']]
    }},
  { id: 'walk', title: 'An Evening Walk', source: 'Урок 20:30, примерно 1:04:17–1:06:31. Ты рассказал про регулярные прогулки, спокойный темп и дистанцию около 7–10 км, а также упомянул друзей и кофе.',
    task: 'Пригласи собеседника на прогулку. Объясни свой обычный темп и договорись, где встретиться и когда остановиться на кофе.',
    versions: {
      A1: [['What do you do in the evenings?', 'I go for a walk.'], ['Do you walk fast?', 'No, I walk slowly. It helps me relax.'], ['Do you walk far?', 'Yes, sometimes about ten kilometres.'], ['Can I come with you?', 'Yes. We can stop for coffee.']],
      A2: [['How do you relax in the evening?', 'I usually go for a walk.'], ['How far do you usually go?', 'Around seven to ten kilometres.'], ['Is it a fast walk?', 'No, I take it easy. I sometimes meet friends for coffee afterwards.'], ['Could we go for a shorter walk together?', 'Sure. Let’s walk for a while and then get coffee.']],
      B1: [['What’s your usual way to unwind after work?', 'I go for a walk in the evening. I sometimes cover about ten kilometres.'], ['Do you walk that far for exercise?', 'I walk at a relaxed pace. The main thing for me is to unwind.'], ['What if a friend wants to join but doesn’t want to walk that far?', 'We can do a shorter stretch and stop for coffee.'], ['That sounds good. How about tomorrow evening?', 'Tomorrow works. Shall we meet by the park?']],
      B2: [['You said you walk around ten kilometres. How much time do you set aside?', 'I can spend around two hours walking, though the distance varies. Seven kilometres is fine, too.'], ['Do you keep a particular pace?', 'I take it at an easy pace. It’s a way to switch off in the evening.'], ['Could we fit in a walk and still have time to catch up?', 'Yes. We could take a shorter route and stop at a café to talk.'], ['Shall we meet at the park and see how we feel?', 'That works. We can decide how far to go once we’re there.']],
      C1: [['Ten kilometres sounds like a workout. Is that how you think about it?', 'I see it mainly as a way to unwind. I’m happy walking seven kilometres or ten, and I don’t push the pace.'], ['Would inviting someone along change the experience?', 'A little. I’d choose a distance that suits us both, and we could stop for coffee if we want to catch up.'], ['So you’d be comfortable changing your usual route?', 'Of course. If we’re going out to talk, there’s no reason to insist on a long walk.'], ['Then let’s start at the park and decide as we go.', 'Sounds good. We can stop at a café whenever we feel like it.']],
      C2: [['You describe a two-hour walk as relaxing. Is it the distance, the routine, or the chance to switch off?', 'The chance to switch off matters most. I may walk seven to ten kilometres, but I’m going at a pace that feels comfortable.'], ['Does it still serve that purpose if you turn it into a social occasion?', 'It can. Walking alone and catching up with friends are different ways to unwind. A walk can lead naturally to coffee and a conversation.'], ['How would you plan it for someone who has less time or stamina?', 'I’d suggest a short stretch and leave the rest open. That gives us room to talk without making the distance a condition of joining.'], ['So what would you suggest for tomorrow?', 'Meet by the park, take a short walk and decide together whether to carry on or stop for coffee.']]
    }},
  ...extraScenes
];

const followUps: Record<string, Pair[]> = {
  introduction: [
    ['Where is the learner originally from?', 'Russia.'], ['Where does he live now?', 'Guangzhou, China.'], ['Which three languages does he mention?', 'Russian, Chinese and English.'], ['What shared interest brings the community together?', 'An interest in tea.']
  ],
  restaurant: [
    ['Which setting appeals to the learner?', 'A restaurant by the water.'], ['What matters more to him than the view?', 'The quality of the food.'], ['Which dish does he mention?', 'Beef and truffle dumplings.'], ['What can they check before deciding?', 'The menu.']
  ],
  walk: [
    ['What activity does the learner describe?', 'Going for an evening walk.'], ['Does he prefer an easy pace or a fast pace?', 'An easy pace.'], ['What distance does he mention?', 'About ten kilometres at A1 and B1; around seven to ten kilometres, or those two distances, at the other levels.'], ['What can they do after walking for a while?', 'Stop for coffee.']
  ]
};

const languageNotes: Record<string, Pair[]> = {
  introduction: [
    ['I live in Guangzhou, China.', 'Я живу в Гуанчжоу, Китай. Сначала город, потом страна.'],
    ['I speak Russian, Chinese and English.', 'Я говорю по-русски, по-китайски и по-английски. Достаточно одного I speak.'],
    ['A community of tea enthusiasts', 'Сообщество любителей чая. Of связывает сообщество с его участниками.']
  ],
  restaurant: [
    ['Based on my first impression, I’d choose the restaurant by the water.', 'Судя по первому впечатлению, я бы выбрал ресторан у воды.'],
    ['Food quality is my top priority.', 'Для меня на первом месте качество еды.'],
    ['I often have beef and truffle dumplings.', 'Я часто ем пельмени с говядиной и трюфелем. Для привычки используй I often have.']
  ],
  walk: [
    ['I go for a walk in the evening.', 'По вечерам я выхожу на прогулку. Go for a walk — идти гулять.'],
    ['I walk at a relaxed pace.', 'Я гуляю в спокойном темпе. Walk — идти пешком, work — работать.'],
    ['I walk around seven to ten kilometres.', 'Я прохожу примерно семь–десять километров.']
  ]
};

export const starterScenes = scenes.map(({ id, title }) => ({ id, title }));

export const starterLessons = scenes.flatMap(scene => levels.map(level => {
  const turns = scene.versions[level];
  const resource: Resource = {
    id: 'starter:en:' + scene.id + ':' + level, language: 'en', title: scene.title + ' · ' + level,
    kind: 'dialogue', text: turns.map(([question, answer]) => 'Partner: ' + question + '\nLearner: ' + answer).join('\n\n'),
    prompt: scene.task, answer: '', url: ''
  };
  const questions = (scene.questions ?? followUps[scene.id]).map(([question, answer]): Pair => [
    question, scene.id === 'walk' && question.startsWith('What distance')
      ? (level === 'A1' || level === 'B1' ? 'About ten kilometres.' : 'Around seven to ten kilometres.')
      : answer
  ]);
  return { sceneId: scene.id, level, resource, source: scene.source, questions, notes: scene.notes ?? languageNotes[scene.id] };
}));

export function isStarterResource(id: string) {
  return starterLessons.some(lesson => lesson.resource.id === id) || /^starter:en:(A1|A2|B1|B2|C1|C2)$/.test(id);
}
