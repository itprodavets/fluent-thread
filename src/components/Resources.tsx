import { useState } from 'react';
import { useWorkspace } from '../context';
import { storyHourLesson } from '../domain/bundled-lessons';
import { applyChatPackage, parseChatPackage } from '../domain/chat-package.js';
import { selectLanguage } from '../domain/model';
import { Heading } from './common';

export function Resources() {
  const { study, update, notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const imported = study.topics.some(topic => topic.language === 'en' && topic.title === storyHourLesson.title);
  async function openLesson() {
    setBusy(true);
    try {
      const packet = parseChatPackage((await storyHourLesson.load()).default);
      let topicId = '';
      const saved = await update(current => {
        const result = applyChatPackage(current, packet);
        topicId = result.topic.id;
        return selectLanguage(result.next, 'en');
      });
      if (saved) location.hash = '#materials/lesson/' + encodeURIComponent(topicId);
    } catch {
      notify('Не удалось открыть занятие. Проверь соединение и попробуй ещё раз.');
    } finally { setBusy(false); }
  }
  return <>
    <Heading title="Ресурсы" label="Чтение и аудирование" detail="Полезные сайты и занятия, которые помогают превратить прочитанное в собственную речь." />
    <div className="resource-catalog">
      <article className="resource">
        <p className="kicker">Бесплатно · английский · самостоятельная практика</p>
        <h2>ESL-Bits</h2>
        <p>Рассказы и другие тексты с аудио для чтения и аудирования. В каталоге коротких рассказов — материалы для Intermediate и Advanced.</p>
        <div className="actions">
          <a className="button" href="https://esl-bits.eu/home.html" target="_blank" rel="noreferrer">Открыть ESL-Bits ↗</a>
          <a href="https://esl-bits.eu/ESL.English.Listening.Short.Stories/Short.Stories.html" target="_blank" rel="noreferrer">Каталог рассказов ↗</a>
        </div>
        <details className="fold"><summary>Как заниматься с сайтом</summary>
          <ol><li>Послушай небольшой отрывок без текста и сформулируй основную мысль.</li>
            <li>Прочитай текст, послушай ещё раз и проверь, что не расслышал.</li>
            <li>Выбери 5–8 выражений и составь с ними собственные примеры.</li>
            <li>Перескажи отрывок и вернись к карточкам в «Повторить сегодня».</li></ol>
          <p className="sub">Оригинальное аудио открывается на сайте источника. В Fluent Thread доступна синтетическая озвучка учебных текстов.</p>
        </details>
      </article>
      <article className="resource">
        <p className="kicker">Первое занятие · Kate Chopin</p>
        <h2>The Story of an Hour</h2>
        <p>Свобода, смешанные чувства и неожиданная концовка. Сначала прочитай или послушай оригинал: учебные пересказы раскрывают сюжет.</p>
        <p className="sub">48 слов и выражений · 10 карточек фраз · пересказы и диалоги A1–C2 с переводом · 16 упражнений с ответами</p>
        <div className="actions">
          <button type="button" className="primary" disabled={busy} onClick={openLesson}>{busy ? 'Открываем…' : imported ? 'Продолжить занятие' : 'Открыть занятие'}</button>
          <a href="https://esl-bits.eu/ESL.English.Listening.Short.Stories/Kate.Chopin/An.Hour/design.html" target="_blank" rel="noreferrer">Оригинал на ESL-Bits ↗</a>
          <a href="https://www.katechopin.org/story-hour/" target="_blank" rel="noreferrer">Текст у Kate Chopin Society ↗</a>
        </div>
        <p className="sub">Учебные версии написаны для практики; уровни обозначают сложность адаптации. При открытии занятие сохраняется в материалах этого браузера. Отмеченные карточки попадают в общую очередь повторения.</p>
      </article>
    </div>
  </>;
}
