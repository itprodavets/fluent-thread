import { useState } from 'react';
import { Heading } from './common';
import directory from '../../materials/en/schools/programs.json';

const categories = [
  ['all', 'Все программы'], ['free', 'Бесплатные занятия'], ['limited', 'Бесплатно с ограничениями'],
  ['self', 'Самостоятельно'], ['check', 'Уточнить набор или цену'], ['paid', 'Платные']
] as const;

export function SchoolDirectory() {
  const [category, choose] = useState<string>('all');
  const [query, search] = useState('');
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const programs = directory.programs.filter(program => (category === 'all' || category === program.category) &&
    terms.every(term => [program.name, program.level, program.details].join(' ').toLocaleLowerCase().includes(term)));
  return <><Heading title="Школы и курсы" detail="Каталог программ английского с условиями участия и ссылками для записи." />
  <section className="school-directory" aria-label="Школы и программы">
    <div className="directory-controls">
      <p className="sub">Данные каталога на 16 ноября 2026. Ближайший набор и доступ из Сингапура проверяй у организатора.</p>
      <label>Найти школу, уровень или формат<input type="search" value={query} onChange={event => search(event.target.value)} /></label>
      <div className="actions" role="group" aria-label="Условия участия">
        {categories.map(([id, label]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => choose(id)}>{label}</button>)}
      </div>
      <p className="sub" role="status">Найдено программ: {programs.length}</p>
    </div>
    <div className="directory-programs">
      {programs.map(program => <article key={program.name} className="resource directory-program">
        <h3>{program.name}</h3>
        <p className="directory-cost">{program.cost}</p>
        <p className="sub">{program.level}</p>
        <p>{program.details}</p>
        <div className="actions">
          {program.link && <a className="button" href={program.link} target="_blank" rel="noreferrer">{program.link.startsWith('mailto:') ? 'Написать' : 'Страница записи'}</a>}
          {program.site && program.site !== program.link && <a href={program.site} target="_blank" rel="noreferrer">Сайт организатора ↗</a>}
        </div>
      </article>)}
    </div>
  </section></>;
}
