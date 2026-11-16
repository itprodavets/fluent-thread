import { inspectSpeech } from './speech-feedback.ts';

type Correction = { before: string; after: string; reason: string };
type Rule = { pattern: RegExp; replacement: string; forms?: Record<string, string>; reason: string };
const common: Rule[] = [
  { pattern: /\b(could|would|can|will)\s+(you|we|I|he|she|they)\s+to\s+(\w+)/gi, replacement: '$1 $2 $3', reason: 'После модального глагола используй начальную форму без to.' },
  { pattern: /\b(I[’']ll|we[’']ll|I will|we will)\s+to\s+(\w+)/gi, replacement: '$1 $2', reason: 'После will или ’ll форма глагола идёт без to.' },
  { pattern: /\blet (me|us|him|her|them) to (\w+)/gi, replacement: 'let $1 $2', reason: 'После let + человек используй глагол без to.' }
];
const rules: Record<string, Rule[]> = {
  'polite-questions': [
    { pattern: /\b(would you mind)\s+(pick|give|read|repeat|say|tell|move|send)\b/gi, replacement: '$1 $2', forms: { pick: 'picking', give: 'giving', read: 'reading', repeat: 'repeating', say: 'saying', tell: 'telling', move: 'moving', send: 'sending' }, reason: 'После Would you mind используй форму на -ing.' },
    { pattern: /\b((?:could|can|would) you tell me (?:where|when|how)) (can|will|is|are) (I|you|he|she|we|they|it)\b/gi, replacement: '$1 $3 $2', reason: 'Внутри косвенного вопроса порядок слов как в утверждении: подлежащее, затем глагол.' }
  ],
  'future-plans': [
    { pattern: /\b(am|is|are|I[’']m) going (book|drive|take|improve|meet|practise|practice|write|check|visit|spend)\b/gi, replacement: '$1 going to $2', reason: 'Для намерения используй be going to + глагол.' },
    { pattern: /\b(I[’']ll|we[’']ll|I will|we will) (meeting|going|booking|driving|writing|picking)\b/gi, replacement: '$1 $2', forms: { meeting: 'meet', going: 'go', booking: 'book', driving: 'drive', writing: 'write', picking: 'pick' }, reason: 'После will используй начальную форму, например will meet.' }
  ],
  disagreeing: [
    { pattern: /\b(I|we|they) (?:am|are) (agree|disagree)\b/gi, replacement: '$1 $2', reason: 'Agree и disagree уже глаголы. Для обычного мнения достаточно I agree или I disagree.' },
    { pattern: /\b(I see what) do (you mean)\b/gi, replacement: '$1 $2', reason: 'В I see what you mean не нужна вопросительная форма do you mean.' },
    { pattern: /\b(would it work if) (I|we|you|they) (will leave|will go|will meet|will take)\b/gi, replacement: '$1 $2 $3', forms: { 'will leave': 'left', 'will go': 'went', 'will meet': 'met', 'will take': 'took' }, reason: 'В этом вежливом предложении после Would it work if используй форму прошедшего времени.' }
  ]
};
const style: Record<string, Rule[]> = {
  'polite-questions': [
    { pattern: /^tell me (where|when|how) ([^.!?]+)[.!?]?/gi, replacement: 'Could you tell me $1 $2?', reason: 'Просьба с Could you tell me… звучит мягче прямого указания.' },
    { pattern: /\bI want you to (read|repeat|explain|tell|check|send) ([^.!?]+)[.!?]?/gi, replacement: 'Could you $1 $2?', reason: 'Для короткой вежливой просьбы подойдёт Could you…?' }
  ],
  disagreeing: [
    { pattern: /\bI disagree with you[.!?]?/gi, replacement: 'I see your point, but I see it differently.', reason: 'Если нужен мягкий тон, сначала покажи, что услышал собеседника. Затем добавь свою причину.' }
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
        corrections.push({ before: match[0], after, reason: rule.reason });
    }
  }
  return corrections;
}

export function inspectSkillAnswer(text: string, skill: string, patterns: string[]) {
  const scanned = inspectSpeech(text, patterns, 'en');
  const corrections: Correction[] = scanned.issues.map(issue => ({
    before: text.slice(issue.start, issue.end), after: issue.correction, reason: 'Согласуй глагол с подлежащим.'
  }));
  corrections.push(...applyRules(text, [...common, ...(rules[skill] ?? [])]));
  const suggestions = applyRules(text, style[skill] ?? []);
  return { corrections, suggestions, patterns: scanned.words };
}
