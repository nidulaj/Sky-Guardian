import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VoiceJourneyPanel from '@/components/voice/VoiceJourneyPanel';
import { getVoiceBriefing, getVoiceConfig, interpretVoiceText, transcribeVoice } from '@/lib/api/voice';
import type { JourneyAnalysisResponse } from '@/types/journey';
import type { VoiceDraft } from '@/types/voice';

vi.mock('@/lib/api/voice', () => ({
  getVoiceConfig: vi.fn(), interpretVoiceText: vi.fn(), transcribeVoice: vi.fn(), getVoiceBriefing: vi.fn(),
}));

const draft: VoiceDraft = {
  transcript: 'UL001 from CMB to KUL', intent: 'analyze_journey', language: 'en',
  legs: [{ flight_number: 'UL001', origin: 'CMB', destination: 'KUL', travel_date: null }],
  missing_fields: ['Flight 1: travel date'], warnings: [], requires_review: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVoiceConfig).mockResolvedValue({ available: true, languages: { en: 'English', si: 'Sinhala', ta: 'Tamil' }, max_audio_bytes: 8388608, max_recording_seconds: 60 });
  vi.mocked(interpretVoiceText).mockResolvedValue(draft);
});
afterEach(() => vi.unstubAllGlobals());

async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Voice assistant' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record journey' })).toBeEnabled());
}

function setup(analysis: JourneyAnalysisResponse | null = null) {
  const onDraft = vi.fn();
  const onLanguageChange = vi.fn();
  const view = render(<VoiceJourneyPanel language="en" onLanguageChange={onLanguageChange} onDraft={onDraft} analysis={analysis} />);
  return { onDraft, onLanguageChange, ...view };
}

async function describeJourney() {
  fireEvent.change(screen.getByLabelText('Journey description'), { target: { value: draft.transcript } });
  fireEvent.click(screen.getByRole('button', { name: 'Interpret journey description' }));
}

describe('Voice journey input', () => {
  it('does not call the backend until opened', () => {
    setup();
    expect(getVoiceConfig).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Journey description')).not.toBeInTheDocument();
  });

  it('requires an explicit review action and keeps missing dates blank', async () => {
    const { onDraft } = setup();
    await open();
    await describeJourney();
    await screen.findByText('Journey draft');
    expect(onDraft).not.toHaveBeenCalled();
    expect(screen.getByText('Date needed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use these flight details' }));
    expect(onDraft).toHaveBeenCalledWith([{ flight_number: 'UL001', origin: 'CMB', destination: 'KUL', travel_date: '' }]);
    expect(getVoiceBriefing).not.toHaveBeenCalled();
  });

  it('discards the old draft when the transcript changes', async () => {
    setup(); await open(); await describeJourney();
    await screen.findByText('Journey draft');
    fireEvent.change(screen.getByLabelText('Journey description'), { target: { value: 'different flights' } });
    expect(screen.queryByRole('button', { name: 'Use these flight details' })).not.toBeInTheDocument();
  });

  it('offers the three requested languages', async () => {
    const { onLanguageChange } = setup(); await open();
    fireEvent.click(screen.getByRole('button', { name: 'Sinhala' }));
    expect(onLanguageChange).toHaveBeenCalledWith('si');
    fireEvent.click(screen.getByRole('button', { name: 'Tamil' }));
    expect(onLanguageChange).toHaveBeenCalledWith('ta');
  });

  it('keeps input disabled when Gemini is not configured', async () => {
    vi.mocked(getVoiceConfig).mockResolvedValue({ available: false, languages: { en: 'English', si: 'Sinhala', ta: 'Tamil' }, max_audio_bytes: 8388608, max_recording_seconds: 60 });
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Voice assistant' }));
    await screen.findByText(/Voice input is currently unavailable/);
    expect(screen.getByRole('button', { name: 'Record journey' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Interpret journey description' })).toBeDisabled();
  });

  it('displays a recoverable error when microphone permission is denied', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } });
    setup(); await open();
    fireEvent.click(screen.getByRole('button', { name: 'Record journey' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
    expect(transcribeVoice).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Journey description')).toBeEnabled();
  });

  it('ignores a response after cancellation', async () => {
    let resolve!: (value: VoiceDraft) => void;
    vi.mocked(interpretVoiceText).mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { onDraft } = setup(); await open(); await describeJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel voice request' }));
    await act(async () => resolve(draft));
    expect(screen.queryByText('Journey draft')).not.toBeInTheDocument();
    expect(onDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Interpret journey description' })).toBeEnabled();
  });

  it('does not make a briefing request without a journey assessment', async () => {
    vi.mocked(interpretVoiceText).mockResolvedValue({ ...draft, intent: 'read_summary', legs: [] });
    setup(); await open(); await describeJourney();
    await screen.findByText('Check a journey first to hear its assessment.');
    expect(getVoiceBriefing).not.toHaveBeenCalled();
  });

  it('keeps the written briefing when audio fails', async () => {
    vi.mocked(getVoiceBriefing).mockResolvedValue({ text: 'Demo assessment. Risk: 78 out of 100.', language: 'en', audio_base64: null, audio_mime_type: null, warnings: ['Audio unavailable'] });
    setup({ journey_id: 'j1' } as JourneyAnalysisResponse); await open();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare spoken assessment' }));
    await screen.findByText('Demo assessment. Risk: 78 out of 100.');
    expect(screen.getByText(/Generated audio is unavailable/)).toBeInTheDocument();
  });

  it('shows provider errors without replacing journey details', async () => {
    vi.mocked(interpretVoiceText).mockRejectedValue(new Error('Gemini quota exhausted.'));
    const { onDraft } = setup(); await open(); await describeJourney();
    expect(await screen.findByRole('alert')).toHaveTextContent('Gemini quota exhausted.');
    expect(onDraft).not.toHaveBeenCalled();
  });
});
