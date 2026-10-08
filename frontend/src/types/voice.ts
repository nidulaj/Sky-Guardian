import type { FlightLegInput, JourneyAnalysisResponse } from './journey';

export type VoiceLanguage = 'en' | 'si' | 'ta';

export interface VoiceConfig {
  available: boolean;
  languages: Record<VoiceLanguage, string>;
  max_audio_bytes: number;
  max_recording_seconds: number;
}

export interface VoiceDraft {
  transcript: string;
  intent: 'analyze_journey' | 'read_summary' | 'unsupported';
  legs: { [K in keyof FlightLegInput]: string | null }[];
  language: VoiceLanguage;
  missing_fields: string[];
  warnings: string[];
  requires_review: true;
}

export interface VoiceBriefing {
  text: string;
  language: VoiceLanguage;
  audio_base64: string | null;
  audio_mime_type: string | null;
  warnings: string[];
}

export interface VoiceChatContext {
  language: VoiceLanguage;
  history: { role: 'user' | 'assistant'; text: string }[];
  legs: VoiceDraft['legs'];
  analysis: JourneyAnalysisResponse | null;
}

export interface VoiceChatReply extends VoiceBriefing {
  transcript: string;
  legs: VoiceDraft['legs'];
  missing_fields: string[];
  sources: { name: string; url?: string | null; verified: boolean; data_mode?: string | null }[];
}
