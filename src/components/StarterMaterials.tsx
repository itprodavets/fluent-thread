import { useState } from 'react';
import { useWorkspace } from '../context';
import { upsert } from '../domain/model';
import { englishLessons, levels } from '../domain/starter-materials';
import type { Level } from '../domain/starter-materials';
import { Fold, SourceText } from './common';

export function StarterMaterials() {
  const { study, update, practice } = useWorkspace();
  const [level, chooseLevel] = useState<Level>('A1');
  if (study.language !== 'en') return <p className="sub">Готовые тексты с русским переводом доступны в английском разделе. Для этого языка можно добавить свои материалы ниже.</p>;
  const { resource, glossary, questions } = englishLessons[level];
  return <section className="starter-library" aria-labelledby="starter-library-title">
    <h2 id="starter-library-title">Стартовые материалы</h2>
    <p className="sub">Прослушай диалог, ответь на вопросы по смыслу и разыграй одну из ролей.</p>
    <div className="level-tabs" role="group" aria-label="Уровень материала">
      {levels.map(value => <button type="button" key={value} aria-pressed={value === level} onClick={() => chooseLevel(value)}>{value}</button>)}
    </div>
    <article className="resource starter-lesson" key={level}>
      <p className="kicker">{level} · Английский → русский</p>
      <h3 lang={resource.language}>{resource.title}</h3>
      <SourceText text={resource.text} language={resource.language} glossary={glossary} />
      <Fold title="Перевод на русский"><p className="source-text" lang="ru">{resource.translation}</p></Fold>
      <section aria-label="Понимание диалога">
        <h4>Вопросы по диалогу</h4>
        <ol>{questions.map(([question, answer]) => <li key={question}>
          <p lang="en">{question}</p>
          <Fold title="Показать ответ"><p lang="en">{answer}</p></Fold>
        </li>)}</ol>
      </section>
      <p>{resource.prompt}</p>
      <div className="actions">
        <button type="button" className="primary" onClick={async () => {
          if (await update(current => ({ ...current, resources: upsert(current.resources, resource) }))) practice(resource.id);
        }}>Разыграть диалог</button>
      </div>
    </article>
  </section>;
}
