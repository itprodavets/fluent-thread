import { useMemo, useState } from 'react';
import { useWorkspace } from '../context';
import { normalize } from '../domain/model';
import { GlossaryText } from './Glossary';
import { Fold } from './common';

export function ReadableMaterial({ text, language, translation, dialogue, notes = [] }: {
  text: string; language: string; translation?: string; dialogue?: boolean; notes?: [string, string][];
}) {
  const { active } = useWorkspace();
  const [selection, setSelection] = useState<{ text: string; meaning?: string }>();
  const glossary = useMemo(() => {
    const entries = new Map<string, string>();
    for (const word of active.words) if (word.language === language && word.meaning) entries.set(normalize(word.title, language), word.meaning);
    return entries;
  }, [active.words, language]);
  const lines = text.split(dialogue ? /\n+/ : /\n{2,}/).map(line => line.trim()).filter(Boolean);
  const speakers = new Map<string, number>();
  function translateSelection(container: HTMLElement) {
    const selected = window.getSelection();
    if (!selected || selected.isCollapsed || !container.contains(selected.anchorNode) || !container.contains(selected.focusNode)) return;
    const text = selected.toString().trim();
    if (!text || text.length > 400) return;
    const key = normalize(text, language).replace(/[.!?,;:]+$/u, '');
    setSelection({ text, meaning: glossary.get(key) ?? notes.find(([phrase]) => normalize(phrase, language).replace(/[.!?,;:]+$/u, '') === key)?.[1] });
  }
  return <div className="readable-material">
    <p className="sub">Нажми на подчёркнутую фразу или выдели текст, чтобы посмотреть перевод из словаря.</p>
    <div onPointerUp={event => translateSelection(event.currentTarget)} onKeyUp={event => translateSelection(event.currentTarget)} onContextMenu={event => translateSelection(event.currentTarget)}>
      {lines.map((line, i) => {
        const turn = dialogue ? /^([^:\n]{1,45}):\s*(.+)$/s.exec(line) : null;
        if (!turn) return <GlossaryText key={i} text={line} language={language} glossary={glossary} />;
        if (!speakers.has(turn[1])) speakers.set(turn[1], speakers.size);
        return <div key={i} className={'dialogue-line voice-' + (speakers.get(turn[1])! % 2)}>
          <strong lang={language}>{turn[1]}</strong>
          <GlossaryText text={turn[2]} language={language} glossary={glossary} />
        </div>;
      })}
    </div>
    {selection && <div className="translation-selection" role="status">
      <strong lang={language}>{selection.text}</strong>
      <p>{selection.meaning ?? 'Перевода этого фрагмента пока нет в словаре.'}</p>
      <button type="button" onClick={() => setSelection(undefined)}>Закрыть перевод</button>
    </div>}
    {translation && <Fold title="Перевод материала"><p className="source-text" lang="ru">{translation}</p></Fold>}
  </div>;
}
