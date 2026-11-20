# Learning materials · Учебные материалы

Choose the language first / Сначала выбери язык:

| Language | Lessons | Skills | Resources | Schools |
| --- | --- | --- | --- | --- |
| [English · Английский](en/) | [By school and topic](en/lessons/) | [Skills](en/skills/) | [Reading resources](en/resources/) | [Free programs and registration](en/schools/) |

## Structure

```text
materials/
  catalog.json                   # Available languages and their catalogs
  en/                            # Language code, not UI/translation language
    lessons/
      catalog.json               # Stable lesson IDs, schools, dates and paths
      teaching-house/
        nature-and-nurture/
          README.md              # Complete human-readable lesson
          lesson.json            # App import package
          sources.json           # Recording provenance, limits and coverage
          transcript.json        # English + Russian contextual explanations
          source-transcript.json # Full anonymized ASR, where available
    skills/catalog.json          # Cross-school practice by skill
    resources/                   # Independent reading/listening resources
    schools/                     # School eligibility and registration catalog
```

Dates belong in lesson metadata and source descriptions, rather than top-level folders. Folder names and stable lesson IDs use English slugs. `en` denotes the language being learned; Russian translations do not make these Russian lessons. Add another language under its BCP 47 code when real content is available; do not mix it into `en`.

Each topic has a canonical folder. Add future analyses of that topic to the same package and source list. Preserve existing topic/resource/word IDs and review history when updating an imported lesson. Distinct sessions can have their own source/transcript files inside the topic when needed; do not overwrite an earlier recording's provenance. The lesson catalog retains `legacyPath` for finding relocated material; Git history retains earlier versions. Historical GitHub URLs to date folders should be replaced with the current canonical links.

Audio from classes stays on the owner's device. Publish only text approved for study, with personal learner names replaced by roles and uncertain recognition explicitly marked. Adapted dialogues must be identified as practice, not verbatim speech.

For a new lesson: add the topic folder and `lesson.json`, list it in the language's lesson catalog, register its lazy loader in `src/domain/bundled-lessons.ts`, and add a transcript loader if applicable. Run the catalog/link/coverage tests, then the full test suite and build. The app package format is `fluent-thread`, version `1`.
