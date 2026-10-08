import { API_BASE_URL, ApiError } from './client';
import { todayISODate } from '@/lib/date';
import type { JourneyAnalysisResponse } from '@/types/journey';
import type { VoiceBriefing, VoiceConfig, VoiceDraft, VoiceLanguage } from '@/types/voice';

async function voiceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const timeout = new AbortController();
  const cancel = () => timeout.abort();
  init.signal?.addEventListener('abort', cancel, { once: true });
  if (init.signal?.aborted) timeout.abort();
  const timer = window.setTimeout(cancel, 100000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/voice/${path}`, { ...init, signal: timeout.signal });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(typeof data?.detail === 'string' ? data.detail : 'The voice request could not be completed.', response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(timeout.signal.aborted
      ? 'The voice request took too long. Please try again.'
      : 'The voice service could not be reached. Please try again.');
  } finally {
    window.clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}

export const getVoiceConfig = (signal?: AbortSignal) => voiceRequest<VoiceConfig>('config', { signal });

export function interpretVoiceText(text: string, language: VoiceLanguage, signal?: AbortSignal) {
  return voiceRequest<VoiceDraft>('interpret', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ text, language, reference_date: todayISODate() }),
  });
}

export function transcribeVoice(audio: Blob, language: VoiceLanguage, signal?: AbortSignal) {
  const data = new FormData();
  const extension = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
  data.append('audio', audio, `journey.${extension}`);
  data.append('language', language);
  data.append('reference_date', todayISODate());
  return voiceRequest<VoiceDraft>('transcribe', { method: 'POST', body: data, signal });
}

export function getVoiceBriefing(analysis: JourneyAnalysisResponse, language: VoiceLanguage, signal?: AbortSignal) {
  return voiceRequest<VoiceBriefing>('briefing', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ analysis, language }),
  });
}
