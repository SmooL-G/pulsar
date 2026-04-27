import { env } from '../../config/env.js';

/**
 * Send an audio URL to our Whisper relay (deployed on a non-RU VPS so
 * the OpenAI API call originates from an allowed geography). The relay
 * downloads the audio itself and posts to /v1/audio/transcriptions.
 *
 * Configure with WHISPER_RELAY_URL + WHISPER_RELAY_TOKEN.
 */
export async function transcribeAudio(s3Key: string, fileName: string): Promise<string> {
  if (!env.WHISPER_RELAY_URL || !env.WHISPER_RELAY_TOKEN) {
    throw new Error('Whisper relay not configured');
  }

  // Resolve the audio URL. R2 stores full URLs; MinIO would store relative keys.
  const audioUrl = s3Key.startsWith('http')
    ? s3Key
    : `${env.S3_PUBLIC_URL}/${s3Key.replace(/^\/+/, '')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000); // 90s — Whisper can be slow on long audio
  try {
    const res = await fetch(`${env.WHISPER_RELAY_URL.replace(/\/+$/, '')}/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHISPER_RELAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl, fileName: fileName || 'voice.webm' }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Relay ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string; error?: string };
    if (!data.text) throw new Error(data.error || 'Empty transcription');
    return data.text;
  } finally {
    clearTimeout(timer);
  }
}
