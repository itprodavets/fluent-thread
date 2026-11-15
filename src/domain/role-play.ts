export type DialogueLine = { speaker: string; text: string };

export function dialogueLines(text: string): DialogueLine[] {
  const turns: DialogueLine[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*([^:\n]{1,45}):\s*(\S.*)$/.exec(line);
    if (match) turns.push({ speaker: match[1].trim(), text: match[2].trim() });
    else if (line.trim() && turns.length) turns[turns.length - 1].text += ' ' + line.trim();
  }
  return new Set(turns.map(turn => turn.speaker)).size >= 2 ? turns : [];
}

export function roleTurns(lines: DialogueLine[], role: string) {
  let partner: DialogueLine[] = [];
  const responses: { partner: DialogueLine[]; model: string }[] = [];
  for (const line of lines) {
    if (line.speaker !== role) partner.push(line);
    else if (!partner.length && responses.length) responses[responses.length - 1].model += '\n' + line.text;
    else { responses.push({ partner, model: line.text }); partner = []; }
  }
  return { responses, closing: partner };
}
