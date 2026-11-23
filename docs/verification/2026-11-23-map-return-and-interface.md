# Map return and interface verification

User requested remembering the map selection after practice, then extended the work to shared spacing and non-overlapping controls across all tabs.

## State and safety

Map filter, query, type, result page, selected node, neighbourhood page, zoom, expanded overview, document scroll and canvas scroll use a validated, versioned browser record keyed by ProfileStore owner and language. No assessment, review schedule, user content or graph coordinates are changed by navigation. No database migration or extra cloud record is introduced. Blocked local storage has an in-memory fallback.

Explicit dialogue links keep resource/level/skill and add a map-return marker. Other map-origin resource and topic practice also provide a return link. Capture freezes before same-tab navigation because React Suspense can leave the outgoing map mounted while App scrolls the next page to the top. Modifier/new-tab/download links do not freeze the original map.

## Browser checks

The nine primary tabs (Today, Map, Materials, Resources, Schools, Progress, Practice, Words, Profile) were checked at viewport widths 320, 768 and 1265. Document width stayed within viewport width and the visible-control rectangle check found no overlaps. Closed details and the deliberately scrollable map canvas were excluded from that rectangle check. Source reviews separately covered dialog headers, long labels, sidebar height and mobile safe area.

The mobile Materials navigation had inherited a legacy `nav { grid-row: 2 }` placement; resetting in-page navigation to auto flow removed its collision with content. Shared resource-card paragraphs/actions now have vertical intervals. Mobile flex bases are reset when their parent becomes a column to avoid blank 220–240px blocks.

Checked reading, library rendering, lesson selection and its mobile close button. With 1129 imported library resources the library renders 12 cards, exposes all 95 pages, and can immediately switch to another section. Closed material bodies are mounted only when opened; full text is retained. Direct resource links choose the containing page.

Map return verified after selecting New, searching, choosing scenes, moving to result page 2/5, selecting a scene and zooming to 150%. Desktop document position returned 592 → 592 and canvas position remained (40,335). A separate 390px phone check (375px content viewport) returned 894 → 894 and retained the selected scene, filters and result page. Saved selection and zoom also survived reload.

## Automated checks

193 tests passed; TypeScript/production build and diff checks passed. Added tests cover profile/language separation, invalid/blocked storage, exact return routes, modifier-click handling, complete library pagination and direct-resource page selection. Test fixtures and disposable guest data were used; no real user's assessments were scored.
