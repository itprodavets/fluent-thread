export function turnSilence(start: number, threshold = 0.018) {
  let voicedSince: number | undefined;
  let lastVoice: number | undefined;
  return (now: number, rms: number) => {
    if (rms >= threshold) {
      voicedSince ??= now;
      if (now - voicedSince >= 180 || lastVoice !== undefined) lastVoice = now;
    } else {
      voicedSince = undefined;
    }
    if (lastVoice !== undefined && (now - lastVoice >= 1800 || now - start >= 60000)) return 'complete';
    if (lastVoice === undefined && now - start >= 15000) return 'no-speech';
    return 'listen';
  };
}
