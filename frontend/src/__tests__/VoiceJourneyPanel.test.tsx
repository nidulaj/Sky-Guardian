import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import VoiceJourneyPanel from '@/components/voice/VoiceJourneyPanel';
import { getVoiceConfig, sendVoiceChat, sendVoiceChatAudio } from '@/lib/api/voice';
import type { JourneyAnalysisResponse } from '@/types/journey';
import type { VoiceChatReply } from '@/types/voice';

vi.mock('@/lib/api/voice', () => ({ getVoiceConfig: vi.fn(), sendVoiceChat: vi.fn(), sendVoiceChatAudio: vi.fn() }));

const reply: VoiceChatReply = {
  transcript: 'UL226 from DXB to CMB', text: 'What is your departure date?', language: 'en',
  legs: [{ flight_number: 'UL226', origin: 'DXB', destination: 'CMB', travel_date: null }],
  missing_fields: ['Flight 1: travel date'], warnings: [], sources: [], audio_base64: null, audio_mime_type: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVoiceConfig).mockResolvedValue({ available: true, languages: { en: 'English', si: 'Sinhala', ta: 'Tamil' }, max_audio_bytes: 8388608, max_recording_seconds: 60 });
  vi.mocked(sendVoiceChat).mockResolvedValue(reply);
});
afterEach(() => vi.unstubAllGlobals());

async function ready() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record message' })).toBeEnabled());
}
function setup(analysis: JourneyAnalysisResponse | null = null) {
  const onDraft = vi.fn();
  const onLanguageChange = vi.fn();
  const view = render(<VoiceJourneyPanel language="en" onLanguageChange={onLanguageChange} onDraft={onDraft} analysis={analysis} />);
  return { onDraft, onLanguageChange, ...view };
}
function send(text = reply.transcript) {
  fireEvent.change(screen.getByLabelText('Message SkyGuardian'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('Conversational voice assistant', () => {
  it('opens as a chat and displays both sides of a conversation', async () => {
    setup(); await ready(); send();
    const log = screen.getByRole('log', { name: 'Travel conversation' });
    expect(within(log).getByText(reply.transcript)).toBeInTheDocument();
    expect(await within(log).findByText(reply.text)).toBeInTheDocument();
    expect(screen.getByLabelText('Message SkyGuardian')).toHaveValue('');
  });

  it('sends history and known legs for a follow-up without applying the draft automatically', async () => {
    const { onDraft } = setup(); await ready(); send();
    await screen.findByText(reply.text);
    send('Tomorrow');
    await waitFor(() => expect(sendVoiceChat).toHaveBeenCalledTimes(2));
    expect(vi.mocked(sendVoiceChat).mock.calls[1][1]).toMatchObject({
      history: [{ role: 'user', text: reply.transcript }, { role: 'assistant', text: reply.text }], legs: reply.legs,
    });
    expect(onDraft).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use these flight details' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Use these flight details' }));
    expect(onDraft).toHaveBeenCalledWith([{ flight_number: 'UL226', origin: 'DXB', destination: 'CMB', travel_date: '' }]);
  });

  it('clears history and flight details for a new conversation', async () => {
    setup(); await ready(); send(); await screen.findByText(reply.text);
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(screen.queryByText(reply.text)).not.toBeInTheDocument();
    send('Hello');
    expect(vi.mocked(sendVoiceChat).mock.calls[1][1]).toMatchObject({ history: [], legs: [] });
  });

  it('offers English, Sinhala and Tamil', async () => {
    const { onLanguageChange } = setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Sinhala' }));
    expect(onLanguageChange).toHaveBeenCalledWith('si');
    fireEvent.click(screen.getByRole('button', { name: 'Tamil' }));
    expect(onLanguageChange).toHaveBeenCalledWith('ta');
  });

  it('disables sends and recording when unconfigured', async () => {
    vi.mocked(getVoiceConfig).mockResolvedValue({ available: false, languages: { en: 'English', si: 'Sinhala', ta: 'Tamil' }, max_audio_bytes: 8388608, max_recording_seconds: 60 });
    setup(); await screen.findByText(/Voice chat is currently unavailable/);
    expect(screen.getByRole('button', { name: 'Record message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('handles microphone permission denial while preserving typed chat', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } });
    setup(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Record message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
    expect(sendVoiceChatAudio).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Message SkyGuardian')).toBeEnabled();
  });

  it('ignores a reply after cancellation', async () => {
    let resolve!: (value: VoiceChatReply) => void;
    vi.mocked(sendVoiceChat).mockImplementation(() => new Promise((done) => { resolve = done; }));
    setup(); await ready(); send();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel voice request' }));
    await act(async () => resolve(reply));
    expect(screen.queryByText(reply.text)).not.toBeInTheDocument();
  });

  it('sends the displayed assessment as context when asked', async () => {
    const analysis = { journey_id: 'j1' } as JourneyAnalysisResponse;
    setup(analysis); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Discuss this assessment' }));
    expect(sendVoiceChat).toHaveBeenCalledWith('Explain my displayed journey assessment.', expect.objectContaining({ analysis }), expect.any(AbortSignal));
    await screen.findByText(reply.text);
  });

  it('keeps written replies and source labels when audio is unavailable', async () => {
    vi.mocked(sendVoiceChat).mockResolvedValue({ ...reply, warnings: ['Audio unavailable'],
      sources: [{ name: 'MockWeatherProvider', data_mode: 'demo', verified: false }] });
    setup(); await ready(); send();
    await screen.findByText(reply.text);
    expect(screen.getByText('Audio unavailable')).toBeInTheDocument();
    expect(screen.getByText('MockWeatherProvider (demo) - unverified')).toBeInTheDocument();
  });

  it('attempts automatic spoken playback and releases audio on reset', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:reply');
    URL.revokeObjectURL = vi.fn();
    vi.mocked(sendVoiceChat).mockResolvedValue({ ...reply, audio_base64: btoa('wav'), audio_mime_type: 'audio/wav' });
    setup(); await ready(); send();
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(screen.getByLabelText('Spoken reply')).toHaveAttribute('src', 'blob:reply');
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reply');
    play.mockRestore();
  });

  it('restores typed text after provider errors', async () => {
    vi.mocked(sendVoiceChat).mockRejectedValue(new Error('Gemini quota exhausted.'));
    setup(); await ready(); send();
    expect(await screen.findByRole('alert')).toHaveTextContent('Gemini quota exhausted.');
    expect(screen.getByLabelText('Message SkyGuardian')).toHaveValue(reply.transcript);
  });

  it('sends Enter but preserves Shift+Enter for a newline', async () => {
    setup(); await ready();
    const input = screen.getByLabelText('Message SkyGuardian');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(sendVoiceChat).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sendVoiceChat).toHaveBeenCalledTimes(1);
    await screen.findByText(reply.text);
  });
});
