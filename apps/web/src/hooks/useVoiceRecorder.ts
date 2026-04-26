import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal MediaRecorder wrapper for voice messages.
 * - Tap start() → mic permission + recording begins.
 * - Tap stop() → resolves with the final Blob.
 * - Tap cancel() → drops the recording without resolving.
 * - `duration` ticks in seconds so the UI can show a timer.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  // Live amplitude levels (0..1) — most recent N samples for the bar viz.
  const [levels, setLevels] = useState<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setRecording(false);
    setDuration(0);
    setLevels([]);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recording) return true;
    setPermissionError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPermissionError('UNSUPPORTED');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer Opus (tiny + good quality). Fall back to whatever the UA supports.
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(250);
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      setRecording(true);

      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);

      // Set up an AnalyserNode to feed bar-graph levels for the UI.
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.fftSize);

        const pump = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(data);
          // RMS amplitude → 0..1
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          // Push into rolling buffer of last 32 samples.
          setLevels((prev) => {
            const next = prev.length >= 32 ? prev.slice(-31) : prev.slice();
            next.push(Math.min(1, rms * 4)); // amplify so soft speech is visible
            return next;
          });
          rafRef.current = requestAnimationFrame(pump);
        };
        rafRef.current = requestAnimationFrame(pump);
      } catch {
        // Visualization is non-critical; recording still works without it.
      }

      return true;
    } catch (err: any) {
      setPermissionError(err?.name === 'NotAllowedError' ? 'DENIED' : 'ERROR');
      cleanup();
      return false;
    }
  }, [recording, cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mr = recorderRef.current;
      if (!mr) {
        resolve(null);
        return;
      }
      const handleStop = () => {
        const mime = mr.mimeType || 'audio/webm';
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: mime })
          : null;
        cleanup();
        resolve(blob);
      };
      mr.addEventListener('stop', handleStop, { once: true });
      try { mr.stop(); } catch { handleStop(); }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const mr = recorderRef.current;
    try { mr?.stop(); } catch { /* noop */ }
    cleanup();
  }, [cleanup]);

  // Safety: release the microphone if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { recording, duration, levels, start, stop, cancel, permissionError };
}

/** Pick a file extension that matches a MediaRecorder MIME type. */
export function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  return 'bin';
}
