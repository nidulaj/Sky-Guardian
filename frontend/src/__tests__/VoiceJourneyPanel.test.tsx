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

class SpeechRecognizer {
  static instance: SpeechRecognizer;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null = null;
  constructor() { SpeechRecognizer.instance = this; }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort = vi.fn();
  say(text: string) { this.onresult?.({ results: [{ 0: { transcript: text }, isFinal: true }] }); }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVoiceConfig).mockResolvedValue({ available: true, languages: { en: 'English', si: 'Sinhala', ta: 'Tamil' }, max_audio_bytes: 8388608, max_recording_seconds: 60 });
  vi.mocked(sendVoiceChat).mockResolvedValue(reply);
});
afterEach(() => vi.unstubAllGlobals());

async function ready() {
  fireEvent.click(screen.getByRole('button', { name: 'Open voice assistant' }));
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
  it('starts as a closed bubble without requesting voice configuration', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Open voice assistant' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Message SkyGuardian')).not.toBeInTheDocument();
    expect(getVoiceConfig).not.toHaveBeenCalled();
  });

  it('closes with Escape, restores focus and retains the conversation and draft', async () => {
    setup(); await ready(); send(); await screen.findByText(reply.text);
    fireEvent.change(screen.getByLabelText('Message SkyGuardian'), { target: { value: 'Tomorrow' } });
    fireEvent.keyDown(screen.getByLabelText('Message SkyGuardian'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open voice assistant' })).toHaveFocus();
    await ready();
    expect(screen.getByRole('dialog', { name: 'Voice assistant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close voice assistant' })).toHaveFocus();
    expect(screen.getByText(reply.text)).toBeInTheDocument();
    expect(screen.getByLabelText('Message SkyGuardian')).toHaveValue('Tomorrow');
    expect(getVoiceConfig).toHaveBeenCalledOnce();
  });

  it('stops dictation when the chat closes and ignores late speech', async () => {
    vi.stubGlobal('SpeechRecognition', SpeechRecognizer);
    setup(); await ready();
    fireEvent.change(screen.getByLabelText('Message SkyGuardian'), { target: { value: 'My flight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record message' }));
    act(() => SpeechRecognizer.instance.say('UL226'));
    const late = SpeechRecognizer.instance.onresult;
    fireEvent.click(screen.getByRole('button', { name: 'Close voice assistant' }));
    act(() => late?.({ results: [{ 0: { transcript: 'late result' }, isFinal: true }] }));
    expect(SpeechRecognizer.instance.abort).toHaveBeenCalledOnce();
    await ready();
    expect(screen.getByLabelText('Message SkyGuardian')).toHaveValue('My flight');
    expect(sendVoiceChat).not.toHaveBeenCalled();
  });

  it('aborts a pending reply when the chat closes', async () => {
    let resolve!: (value: VoiceChatReply) => void;
    vi.mocked(sendVoiceChat).mockImplementation(() => new Promise((done) => { resolve = done; }));
    setup(); await ready(); send();
    const signal = vi.mocked(sendVoiceChat).mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: 'Hide voice assistant' }));
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(reply));
    await ready();
    expect(screen.queryByText(reply.text)).not.toBeInTheDocument();
  });

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

  it('keeps dictation available but disables sending when Gemini is unconfigured', async () => {
    vi.mocked(getVoiceConfig).mockResolvedValue({ available: false, languages: { en: 'English', si: 'Sinhala', ta: 'Tamil' }, max_audio_bytes: 8388608, max_recording_seconds: 60 });
    setup(); await ready(); await screen.findByText(/Voice chat is currently unavailable/);
    expect(screen.getByRole('button', { name: 'Record message' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('handles microphone permission denial while preserving typed chat', async () => {
    vi.stubGlobal('SpeechRecognition', SpeechRecognizer);
    setup(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Record message' }));
    act(() => SpeechRecognizer.instance.onerror?.({ error: 'not-allowed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
    expect(sendVoiceChatAudio).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Message SkyGuardian')).toBeEnabled();
  });

  it('previews speech as editable text and only sends after explicit submission', async () => {
    vi.stubGlobal('SpeechRecognition', SpeechRecognizer);
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Record message' }));
    act(() => SpeechRecognizer.instance.say('UL226 from Dubai'));
    const input = screen.getByLabelText('Message SkyGuardian');
    expect(input).toHaveValue('UL226 from Dubai');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(sendVoiceChat).not.toHaveBeenCalled();
    expect(sendVoiceChatAudio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: 'UL226 from Dubai tomorrow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(sendVoiceChat).toHaveBeenCalledWith('UL226 from Dubai tomorrow', expect.any(Object), expect.any(AbortSignal));
    await screen.findByText(reply.text);
  });

  it('appends dictation without duplicating interim text and preserves the draft when cancelled', async () => {
    vi.stubGlobal('SpeechRecognition', SpeechRecognizer);
    setup(); await ready();
    const input = screen.getByLabelText('Message SkyGuardian');
    fireEvent.change(input, { target: { value: 'My flight is' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record message' }));
    act(() => SpeechRecognizer.instance.say('UL'));
    act(() => SpeechRecognizer.instance.say('UL226'));
    expect(input).toHaveValue('My flight is UL226');
    const late = SpeechRecognizer.instance.onresult;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel voice request' }));
    act(() => late?.({ results: [{ 0: { transcript: 'late result' }, isFinal: true }] }));
    expect(input).toHaveValue('My flight is');
    expect(SpeechRecognizer.instance.abort).toHaveBeenCalledOnce();
    expect(sendVoiceChat).not.toHaveBeenCalled();
  });

  it('retains the dictated message when Gemini rejects a send', async () => {
    vi.stubGlobal('SpeechRecognition', SpeechRecognizer);
    vi.mocked(sendVoiceChat).mockRejectedValue(new Error('Gemini is busy right now.'));
    setup(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Record message' }));
    act(() => SpeechRecognizer.instance.say('Check flight UL226'));
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Gemini is busy');
    expect(screen.getByLabelText('Message SkyGuardian')).toHaveValue('Check flight UL226');
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
    const playCount = play.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Close voice assistant' }));
    await ready();
    await waitFor(() => expect(screen.getByLabelText('Spoken reply')).toHaveAttribute('src', 'blob:reply'));
    expect(play).toHaveBeenCalledTimes(playCount);
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
