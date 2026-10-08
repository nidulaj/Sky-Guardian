import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechInput } from '@/components/voice/useSpeechInput';
import type { VoiceLanguage } from '@/types/voice';

class Recognizer {
  static instance: Recognizer;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null = null;
  constructor() { Recognizer.instance = this; }
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
  say(...phrases: string[]) {
    this.onresult?.({ results: phrases.map((transcript) => ({ 0: { transcript }, isFinal: true })) });
  }
}

beforeEach(() => { vi.stubGlobal('SpeechRecognition', Recognizer); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function setup(language: VoiceLanguage = 'en') {
  const onText = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() => useSpeechInput(language, onText, onError));
  act(() => hook.result.current.start());
  return { ...hook, recognition: Recognizer.instance, onText, onError };
}

describe('Browser speech-to-text', () => {
  it.each([['en', 'en-US'], ['si', 'si-LK'], ['ta', 'ta-LK']] as const)('uses the %s locale', (language, locale) => {
    const { result, recognition } = setup(language);
    expect(recognition.lang).toBe(locale);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.continuous).toBe(true);
    expect(result.current.status).toBe('recording');
  });

  it('reports unsupported browsers without attempting an upload', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    const { result, onError } = setup();
    expect(result.current.status).toBe('idle');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('unavailable in this browser'));
  });

  it('accepts the prefixed Chrome API', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', Recognizer);
    expect(setup().recognition.start).toHaveBeenCalledOnce();
  });

  it('replaces interim results, combines phrases and accepts final results after stop', () => {
    const { result, recognition, onText, onError } = setup();
    act(() => recognition.say('Flight UL'));
    act(() => recognition.say('Flight UL226', 'to Colombo'));
    expect(onText).toHaveBeenLastCalledWith('Flight UL226 to Colombo');
    act(() => result.current.stop());
    expect(result.current.status).toBe('processing');
    act(() => recognition.say('Flight UL226', 'to Colombo tomorrow'));
    act(() => recognition.onend?.());
    expect(result.current.status).toBe('idle');
    expect(onText).toHaveBeenLastCalledWith('Flight UL226 to Colombo tomorrow');
    expect(onError).not.toHaveBeenCalled();
  });

  it('discards late results after cancellation and aborts on unmount', () => {
    const { result, recognition, onText, unmount } = setup();
    const late = recognition.onresult;
    act(() => result.current.cancel());
    act(() => late?.({ results: [{ 0: { transcript: 'late' }, isFinal: true }] }));
    expect(onText).not.toHaveBeenCalled();
    expect(recognition.abort).toHaveBeenCalledOnce();
    act(() => result.current.start());
    const next = Recognizer.instance;
    unmount();
    expect(next.abort).toHaveBeenCalledOnce();
  });

  it('stops at 60 seconds without restarting and bounds final-result waiting', () => {
    vi.useFakeTimers();
    const { result, recognition, onError } = setup();
    act(() => vi.advanceTimersByTime(60000));
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('processing');
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.status).toBe('idle');
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(recognition.start).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('too long to finish'));
  });

  it('cleans timers when stop completes synchronously', () => {
    vi.useFakeTimers();
    const { result, recognition } = setup();
    recognition.stop.mockImplementation(() => recognition.onend?.());
    act(() => result.current.stop());
    expect(result.current.status).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers from a browser stop exception while keeping captured text', () => {
    const { result, recognition, onText, onError } = setup();
    act(() => recognition.say('My flight'));
    recognition.stop.mockImplementation(() => { throw new Error('already stopped'); });
    act(() => result.current.stop());
    expect(result.current.status).toBe('idle');
    expect(onText).toHaveBeenLastCalledWith('My flight');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('stopped unexpectedly'));
  });

  it.each(['not-allowed', 'audio-capture', 'network', 'language-not-supported'])('handles %s errors', (error) => {
    const { result, recognition, onError } = setup();
    act(() => recognition.onerror?.({ error }));
    expect(result.current.status).toBe('idle');
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('type your message'));
  });

  it('reports a silent recording', () => {
    const { result, recognition, onError } = setup();
    act(() => recognition.onend?.());
    expect(result.current.status).toBe('idle');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('No speech was detected'));
  });
});
