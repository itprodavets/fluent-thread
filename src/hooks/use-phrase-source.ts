import { useEffect, useState } from 'react';
import { transcriptLoaders } from '../domain/lesson-text';
import { matchPhraseSource } from '../domain/lesson-transcript';
import type { PhraseAudioSource } from '../domain/lesson-transcript';
import type { Word, Study } from '../domain/model';

export function usePhraseSource(word: Word | undefined, study: Study) {
  const [found, setFound] = useState<{ id: string; source: PhraseAudioSource }>();
  useEffect(() => {
    if (!word || word.audioSource || !word.vocabularyLevel || word.vocabularyLevel === 'learning') return;
    const matchingTopics = new Set(study.topics.filter(topic => topic.links.includes(word.id)).map(topic => topic.id));
    const keys = new Set(study.resources.flatMap(resource => {
      if (!resource.topicId || !matchingTopics.has(resource.topicId)) return [];
      const key = resource.text.match(/^Recording: (lesson-[a-z0-9-]+)$/m)?.[1];
      return key && transcriptLoaders[key] ? [key] : [];
    }));
    let active = true;
    Promise.all([...keys].map(async key => {
      const loader = transcriptLoaders[key];
      const module = await loader?.();
      return module && matchPhraseSource(key, module.default, word.title, word.example);
    })).then(matches => {
      const sources = matches.filter(source => source !== undefined);
      if (active) setFound(sources.length === 1 ? { id: word.id, source: sources[0] } : undefined);
    }).catch(() => {});
    return () => { active = false; };
  }, [word, study.topics, study.resources]);
  return word?.audioSource ?? (found?.id === word?.id ? found?.source : undefined);
}
