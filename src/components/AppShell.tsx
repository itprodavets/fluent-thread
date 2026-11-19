import type { ReactNode } from 'react';
import { pages } from '../domain/model';
import type { Page } from '../domain/model';
import { LanguageMenu } from './Language';
import { Icon } from './Icon';
import { ProfileSummary } from './ProfileSummary';

const destinations = ['today', 'map', 'materials', 'resources', 'schools', 'progress'] as const;

export function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  return <div className="app-shell">
    <a className="skip-link" href="#screen" onClick={event => { event.preventDefault(); document.getElementById('screen')?.focus(); }}>К содержимому</a>
    <aside className="sidebar">
      <a className="brand" href="#today" aria-label="Нить речи — сегодня"><span className="brand-mark"><Icon name="map" /></span><span>нить речи<small>Твой язык. Твой ритм.</small></span></a>
      <p className="nav-caption">ТВОЁ ПРОСТРАНСТВО</p>
      <nav className="primary-nav" aria-label="Основные разделы">{destinations.map(entry => <a key={entry} href={'#' + entry} aria-current={page === entry ? 'page' : undefined}>
        <Icon name={entry} /><span>{pages[entry]}</span>{page === entry && <i aria-hidden="true" />}
      </a>)}</nav>
      <div className="sidebar-secondary"><a href="#practice" aria-current={page === 'practice' ? 'page' : undefined}><Icon name="practice" />Свободная практика</a>
        <a href="#account" aria-current={page === 'account' ? 'page' : undefined}><Icon name="words" />Слова и импорт</a></div>
      <div className="sidebar-note"><ProfileSummary /></div>
    </aside>
    <div className="app-body">
      <header className="topbar"><a className="mobile-brand brand" href="#today"><span className="brand-mark"><Icon name="map" /></span>нить речи</a>
        <span className="breadcrumb">Моё пространство <span>/</span> <strong>{pages[page]}</strong></span>
        <div className="app-controls"><LanguageMenu /><a className="account-control" href="#profile" aria-current={page === 'profile' ? 'page' : undefined} aria-label="Профиль и синхронизация"><Icon name="account" /><span>Профиль</span></a></div>
      </header>
      <main id="screen" data-page={page} tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
