import { turnSilence } from './turn-silence';

export async function captureAnswer(context: AudioContext, stream: MediaStream, signal: AbortSignal) {
  signal.throwIfAborted();
  await context.resume();
  signal.throwIfAborted();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  try {
    const result = await new Promise<Blob | undefined>((resolve, reject) => {
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const samples = new Float32Array(analyser.fftSize);
      let outcome: ReturnType<ReturnType<typeof turnSilence>> = 'listen';
      let timer: number | undefined;
      const cleanup = () => { window.clearInterval(timer); signal.removeEventListener('abort', abort); };
      const abort = () => {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(signal.reason);
      };
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { cleanup(); reject(new Error('Запись прервалась.')); };
      recorder.onstop = () => {
        cleanup();
        if (!signal.aborted) resolve(outcome === 'complete' && chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : undefined);
      };
      recorder.start();
      const detect = turnSilence(performance.now());
      signal.addEventListener('abort', abort, { once: true });
      timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let total = 0;
        for (const value of samples) total += value * value;
        outcome = detect(performance.now(), Math.sqrt(total / samples.length));
        if ((outcome !== 'listen' || !stream.active) && recorder.state !== 'inactive') recorder.stop();
      }, 50);
    });
    return result;
  } finally {
    source.disconnect();
    analyser.disconnect();
  }
}
