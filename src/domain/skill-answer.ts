import { inspectSpeech } from './speech-feedback.ts';

export type Correction = { rule: string; before: string; after: string; reason: string };
type Rule = { id: string; pattern: RegExp; replacement: string; forms?: Record<string, string>; reason: string };
const common: Rule[] = [
  { id: 'modal-to', pattern: /\b(could|would|can|will)\s+(you|we|I|he|she|they)\s+to\s+(\w+)/gi, replacement: '$1 $2 $3', reason: 'После модального глагола используй начальную форму без to.' },
  { id: 'will-to', pattern: /\b(I[’']ll|we[’']ll|I will|we will)\s+to\s+(\w+)/gi, replacement: '$1 $2', reason: 'После will или ’ll форма глагола идёт без to.' },
  { id: 'let-to', pattern: /\blet (me|us|him|her|them) to (\w+)/gi, replacement: 'let $1 $2', reason: 'После let + человек используй глагол без to.' }
];
const rules: Record<string, Rule[]> = {
  'polite-questions': [
    { id: 'mind-ing', pattern: /\b(would you mind)\s+(pick|give|read|repeat|say|tell|move|send)\b/gi, replacement: '$1 $2', forms: { pick: 'picking', give: 'giving', read: 'reading', repeat: 'repeating', say: 'saying', tell: 'telling', move: 'moving', send: 'sending' }, reason: 'После Would you mind используй форму на -ing.' },
    { id: 'indirect-order', pattern: /\b((?:could|can|would) you tell me (?:where|when|how)) (can|will|is|are) (I|you|he|she|we|they|it)\b/gi, replacement: '$1 $3 $2', reason: 'Внутри косвенного вопроса порядок слов как в утверждении: подлежащее, затем глагол.' }
  ],
  'future-plans': [
    { id: 'going-to', pattern: /\b(am|is|are|I[’']m) going (book|drive|take|improve|meet|practise|practice|write|check|visit|spend)\b/gi, replacement: '$1 going to $2', reason: 'Для намерения используй be going to + глагол.' },
    { id: 'will-base', pattern: /\b(I[’']ll|we[’']ll|I will|we will) (meeting|going|booking|driving|writing|picking)\b/gi, replacement: '$1 $2', forms: { meeting: 'meet', going: 'go', booking: 'book', driving: 'drive', writing: 'write', picking: 'pick' }, reason: 'После will используй начальную форму, например will meet.' }
  ],
  disagreeing: [
    { id: 'agree-verb', pattern: /\b(I|we|they) (?:am|are) (agree|disagree)\b/gi, replacement: '$1 $2', reason: 'Agree и disagree уже глаголы. Для обычного мнения достаточно I agree или I disagree.' },
    { id: 'see-meaning', pattern: /\b(I see what) do (you mean)\b/gi, replacement: '$1 $2', reason: 'В I see what you mean не нужна вопросительная форма do you mean.' },
    { id: 'work-if-past', pattern: /\b(would it work if) (I|we|you|they) (will leave|will go|will meet|will take)\b/gi, replacement: '$1 $2 $3', forms: { 'will leave': 'left', 'will go': 'went', 'will meet': 'met', 'will take': 'took' }, reason: 'В этом вежливом предложении после Would it work if используй форму прошедшего времени.' }
  ]
};
const style: Record<string, Rule[]> = {
  'polite-questions': [
    { id: 'soften-tell', pattern: /^tell me (where|when|how) ([^.!?]+)[.!?]?/gi, replacement: 'Could you tell me $1 $2?', reason: 'Просьба с Could you tell me… звучит мягче прямого указания.' },
    { id: 'soften-want', pattern: /\bI want you to (read|repeat|explain|tell|check|send) ([^.!?]+)[.!?]?/gi, replacement: 'Could you $1 $2?', reason: 'Для короткой вежливой просьбы подойдёт Could you…?' }
  ],
  disagreeing: [
    { id: 'soften-disagree', pattern: /\bI disagree with you[.!?]?/gi, replacement: 'I see your point, but I see it differently.', reason: 'Если нужен мягкий тон, сначала покажи, что услышал собеседника. Затем добавь свою причину.' }
  ]
};

function applyRules(text: string, selected: Rule[]) {
  const corrections: Correction[] = [];
  for (const rule of selected) {
    for (const match of text.matchAll(rule.pattern)) {
      const after = rule.replacement.replace(/\$(\d)/g, (_, index) => {
        const part = match[Number(index)];
        return rule.forms?.[part.toLowerCase()] ?? part;
      });
      if (after !== match[0] && !corrections.some(item => item.before === match[0] && item.after === after))
        corrections.push({ rule: rule.id, before: match[0], after, reason: rule.reason });
    }
  }
  return corrections;
}

export function inspectSkillAnswer(text: string, skill: string, patterns: string[]) {
  const scanned = inspectSpeech(text, patterns, 'en');
  const corrections: Correction[] = scanned.issues.map(issue => ({
    rule: 'agreement', before: text.slice(issue.start, issue.end), after: issue.correction, reason: 'Согласуй глагол с подлежащим.'
  }));
  corrections.push(...applyRules(text, [...common, ...(rules[skill] ?? [])]));
  const suggestions = applyRules(text, style[skill] ?? []);
  return { corrections, suggestions, patterns: scanned.words };
}

const reviewEvidence: Record<string, RegExp> = {
  'modal-to': /\b(?:could|would|can|will) (?:you|we|I|he|she|they) (?:read|repeat|give|pick|tell|call|help|check|send|be|meet|go|take|join|try|let|leave|show|explain|share)\b/i,
  'will-to': /\b(?:I[’']ll|we[’']ll|I will|we will) (?:pick|meet|book|go|call|write|drive|check|send|take|leave|lend|ask|help|try|practi[cs]e|give|get|be|let|bring)\b/i,
  'will-base': /\b(?:I[’']ll|we[’']ll|I will|we will) (?:pick|meet|book|go|call|write|drive|check|send|take|leave|lend|ask|help|try|practi[cs]e|give|be)\b/i,
  'let-to': /\blet (?:me|us|him|her|them) (?:try|say|check|go|give|ask|tell|see|know|help|finish|explain|repeat|answer|in)\b/i,
  'mind-ing': /\bwould you mind (?:not )?(?:picking|giving|reading|repeating|saying|telling|moving|sending|checking|explaining|helping|waiting|joining|trying|closing|opening|showing|speaking|asking|taking|sharing|writing|calling|meeting)\b/i,
  'indirect-order': /\b(?:could|can|would) you tell me (?:where|when|how) (?:I|you|he|she|we|they|it|the [a-z]+) (?:can|will|is|are|am|could|would|should|starts|leaves)\b/i,
  'going-to': /\b(?:am|is|are|[a-z]+[’'](?:m|re|s)) going to (?:book|drive|take|improve|meet|practi[cs]e|write|check|visit|spend|call|pick|start|get|ask|try|work|save|learn|be|do|install)\b/i,
  'agree-verb': /\b(?:I|we|they) (?:agree|disagree)\b/i,
  'see-meaning': /\bI see what you mean\b/i,
  'work-if-past': /\bwould it work if (?:I|we|you|they) (?:left|went|met|took|booked|started|called|moved|changed|tried|picked|drove|came|used|told|checked)\b/i
};

export function reviewRuleUsed(text: string, original: Correction) {
  const pattern = reviewEvidence[original.rule];
  if (pattern?.test(text)) return true;
  const normalize = (value: string) => value.toLocaleLowerCase('en').replaceAll('’', "'").replace(/\s+/g, ' ').trim();
  const normalized = normalize(original.after);
  return !!normalized && normalize(text).split(/[^a-z0-9' ]+/).some(part => (' ' + part.trim() + ' ').includes(' ' + normalized + ' '));
}

const reviewCues: Record<string, string> = {
  'modal-to': 'Составь просьбу с модальным глаголом.',
  'will-to': 'Скажи, что сделаешь, используя will.',
  'will-base': 'Скажи, что сделаешь, используя will.',
  'let-to': 'Попроси дать тебе возможность что-то сделать. Используй let.',
  'mind-ing': 'Составь просьбу, начав с Would you mind…?',
  'indirect-order': 'Попроси уточнить деталь, начав с Could you tell me…?',
  'going-to': 'Расскажи о намерении, используя be going to.',
  'agree-verb': 'Вырази согласие или несогласие с помощью agree или disagree.',
  'see-meaning': 'Покажи, что понял собеседника. Начни с I see…',
  'work-if-past': 'Предложи другой вариант с помощью Would it work if…?',
  agreement: 'Обрати внимание на согласование подлежащего и глагола.'
};

export function reviewCue(rule: string) {
  return reviewCues[rule] ?? 'Примени конструкцию из предыдущего ответа.';
}
