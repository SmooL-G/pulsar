import { env } from '../../config/env.js';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper hard limit

/**
 * Download an audio file from our S3-compatible storage and send it to
 * OpenAI Whisper. Returns the recognised text. Whisper auto-detects
 * language, so Russian voice notes come back in Russian, English in
 * English, etc.
 *
 * `s3Key` is the URL we stored when the user uploaded — for R2 it's
 * already a public URL. We just fetch it; no signing needed.
 */
export async function transcribeAudio(s3Key: string, fileName: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Resolve the audio URL. R2: stored as full URL; MinIO: relative key.
  const url = s3Key.startsWith('http')
    ? s3Key
    : `${env.S3_PUBLIC_URL}/${s3Key.replace(/^\/+/, '')}`;

  const audioRes = await fetch(url);
  if (!audioRes.ok) {
    throw new Error(`Failed to fetch audio: ${audioRes.status}`);
  }
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    throw new Error('Audio too large for Whisper (>25 MB)');
  }

  // Whisper expects multipart/form-data with a file part.
  const fd = new FormData();
  // Node 20 has Blob globally.
  fd.append('file', new Blob([buffer], { type: 'audio/webm' }), fileName || 'voice.webm');
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'text');

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Whisper ${res.status}: ${err.slice(0, 200)}`);
  }
  // response_format=text → plain text body
  return (await res.text()).trim();
}
