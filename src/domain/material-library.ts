import type { Resource } from './model';

/** Bound rendered cards; an explicit resource always opens on its own page. */
export function materialLibraryPage(resources: Resource[], topic: string, requested: number, opened?: string, size = 12) {
  const matches = resources.filter(item => !topic || (item.topicId ?? 'unassigned') === topic);
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const selected = opened ? matches.findIndex(item => item.id === opened) : -1;
  const page = selected >= 0 ? Math.floor(selected / size) : Math.max(0, Math.min(pages - 1, Number.isFinite(requested) ? Math.floor(requested) : 0));
  return { items: matches.slice(page * size, (page + 1) * size), page, pages, total: matches.length };
}
