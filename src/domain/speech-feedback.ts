type Span = { start: number; end: number };
type WordToken = Span & { text: string };

const englishForms: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'], do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'], run: ['ran', 'running', 'runs'],
  oversleep: ['overslept', 'oversleeps', 'oversleeping'], have: ['has', 'had', 'having'],
  say: ['says', 'said', 'saying'], make: ['makes', 'made', 'making'],
  take: ['takes', 'took', 'taken', 'taking'], get: ['gets', 'got', 'gotten', 'getting'],
  see: ['sees', 'saw', 'seen', 'seeing'], find: ['finds', 'found', 'finding'],
  meet: ['meets', 'met', 'meeting'], give: ['gives', 'gave', 'given', 'giving']
};

function tokenize(text: string, language: string): WordToken[] {
  const items = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(language, { granularity: 'word' }).segment(text))
      .filter(part => part.isWordLike).map(part => ({ segment: part.segment, index: part.index }))
    : Array.from(text.matchAll(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}]+)*/gu), match => ({ segment: match[0], index: match.index }));
  return items.map(({ segment, index }) => ({
    text: segment.normalize('NFKC').toLocaleLowerCase(language).replaceAll('’', "'"),
    start: index, end: index + segment.length
  }));
}

function forms(word: string, english: boolean) {
  const accepted = new Set([word]);
  if (!english || !/^[a-z]+$/.test(word)) return accepted;
  if (Object.hasOwn(englishForms, word)) return new Set([word, ...englishForms[word]]);
  if (word.length < 3) return accepted;
  if (/[^aeiou]y$/.test(word)) {
    accepted.add(word.slice(0, -1) + 'ies');
    accepted.add(word.slice(0, -1) + 'ied');
  } else {
    accepted.add(word + (/(?:s|x|z|sh|ch)$/.test(word) ? 'es' : 's'));
    accepted.add(word + (word.endsWith('e') ? 'd' : 'ed'));
  }
  accepted.add((/[^e]e$/.test(word) ? word.slice(0, -1) : word) + 'ing');
  return accepted;
}

export function inspectSpeech(transcript: string, targets: string[], language: string) {
  const english = new Intl.Locale(language).language === 'en';
  const tokens = tokenize(transcript, language);
  const words = targets.map(target => {
    const pattern = tokenize(target, language).map(token => forms(token.text, english));
    const index = pattern.length ? tokens.findIndex((_, at) => pattern.every((set, offset) => {
      const token = tokens[at + offset];
      if (!token || !set.has(token.text)) return false;
      return !offset || !/[.!?。！？]/u.test(transcript.slice(tokens[at + offset - 1].end, token.start));
    })) : -1;
    const span = index < 0 ? undefined : { start: tokens[index].start, end: tokens[index + pattern.length - 1].end };
    return { target, span };
  });
  const issues: (Span & { correction: string })[] = [];
  if (english) {
    for (const match of transcript.matchAll(/\b(I|he|she|it|we|you|they)\s+(am|is|are|has|have)\b/gi)) {
      const [phrase, subject, verb] = match;
      const person = subject.toLowerCase();
      const thirdPerson = ['he', 'she', 'it'].includes(person);
      const expected = /^(has|have)$/i.test(verb) ? thirdPerson ? 'has' : 'have'
        : person === 'i' ? 'am' : thirdPerson ? 'is' : 'are';
      if (verb.toLowerCase() !== expected) issues.push({
        start: match.index, end: match.index + phrase.length, correction: subject + ' ' + expected
      });
    }
  }
  return { words, issues };
}

type PhraseDifference =
  | { kind: 'match'; expected: string }
  | { kind: 'missing'; expected: string }
  | { kind: 'changed'; expected: string; heard: string }
  | { kind: 'extra'; heard: string };

const simpleContractions: Record<string, string[]> = {
  "i'm": ['i', 'am'], "you're": ['you', 'are'], "we're": ['we', 'are'], "they're": ['they', 'are'],
  "i've": ['i', 'have'], "you've": ['you', 'have'], "we've": ['we', 'have'], "they've": ['they', 'have'],
  "i'll": ['i', 'will'], "you'll": ['you', 'will'], "he'll": ['he', 'will'], "she'll": ['she', 'will'],
  "we'll": ['we', 'will'], "they'll": ['they', 'will'], "can't": ['can', 'not'], cannot: ['can', 'not'],
  "won't": ['will', 'not'], "don't": ['do', 'not'], "doesn't": ['does', 'not'], "didn't": ['did', 'not'],
  "isn't": ['is', 'not'], "aren't": ['are', 'not'], "wasn't": ['was', 'not'], "weren't": ['were', 'not'],
  "haven't": ['have', 'not'], "hasn't": ['has', 'not'], "hadn't": ['had', 'not'],
  "wouldn't": ['would', 'not'], "couldn't": ['could', 'not'], "shouldn't": ['should', 'not']
};

export function compareSpokenPhrase(expected: string, heard: string, language: string): PhraseDifference[] {
  const english = new Intl.Locale(language).language === 'en';
  const parts = (text: string) => tokenize(text, language).flatMap(token => {
    const expanded = english && Object.hasOwn(simpleContractions, token.text) ? simpleContractions[token.text] : undefined;
    return expanded?.map(value => ({ key: value, label: value }))
      ?? [{ key: token.text, label: text.slice(token.start, token.end) }];
  });
  const target = parts(expected);
  const answer = parts(heard);
  const cost = Array.from({ length: target.length + 1 }, () => new Uint32Array(answer.length + 1));
  for (let i = 0; i <= target.length; i++) cost[i][0] = i * 2;
  for (let j = 0; j <= answer.length; j++) cost[0][j] = j * 2;
  for (let i = 1; i <= target.length; i++) {
    for (let j = 1; j <= answer.length; j++) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + (target[i - 1].key === answer[j - 1].key ? 0 : 3),
        cost[i - 1][j] + 2,
        cost[i][j - 1] + 2
      );
    }
  }
  const differences: PhraseDifference[] = [];
  let i = target.length;
  let j = answer.length;
  while (i || j) {
    const a = target[i - 1];
    const b = answer[j - 1];
    if (a && b && a.key === b.key && cost[i][j] === cost[i - 1][j - 1]) {
      differences.push({ kind: 'match', expected: a.label });
      i--; j--;
    } else if (a && cost[i][j] === cost[i - 1][j] + 2) {
      differences.push({ kind: 'missing', expected: a.label });
      i--;
    } else if (b && cost[i][j] === cost[i][j - 1] + 2) {
      differences.push({ kind: 'extra', heard: b.label });
      j--;
    } else {
      differences.push({ kind: 'changed', expected: a.label, heard: b.label });
      i--; j--;
    }
  }
  return differences.reverse();
}
