'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceLanguage } from '@/types/voice';

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

const LOCALES: Record<VoiceLanguage, string> = { en: 'en-US', si: 'si-LK', ta: 'ta-LK' };
const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow microphone access in your browser, or type your message.',
  'service-not-allowed': 'Your browser blocked speech recognition. Check its microphone settings, or type your message.',
  'audio-capture': 'No microphone is available. Connect one, or type your message.',
  'no-speech': 'No speech was detected. Please try again or type your message.',
  'network': 'The browser speech service could not be reached. Check your connection, or type your message.',
  'language-not-supported': 'Your browser does not support dictation in this language. You can still type your message.',
};

export function useSpeechInput(language: VoiceLanguage, onText: (text: string) => void, onError: (message: string) => void) {
  const [status, setStatus] = useState<'idle' | 'permission' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const recognizer = useRef<Recognition | null>(null);
  const active = useRef(true);
  const callbacks = useRef({ onText, onError });
  callbacks.current = { onText, onError };
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (interval.current) clearInterval(interval.current);
    if (deadline.current) clearTimeout(deadline.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    interval.current = deadline.current = finishTimer.current = null;
  }, []);

  const cancel = useCallback(() => {
    const recognition = recognizer.current;
    recognizer.current = null;
    if (recognition) {
      recognition.onresult = recognition.onstart = recognition.onerror = recognition.onend = null;
      try { recognition.abort(); } catch { /* Already stopped by the browser. */ }
    }
    clearTimers();
    if (active.current) setStatus('idle');
  }, [clearTimers]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; cancel(); };
  }, [cancel]);

  const stop = useCallback(() => {
    const recognition = recognizer.current;
    if (!recognition) return;
    clearTimers();
    setStatus('processing');
    // stop() allows final recognition results to arrive; abort() deliberately discards them.
    try { recognition.stop(); } catch {
      cancel();
      callbacks.current.onError('Speech recognition stopped unexpectedly. Review the text already captured.');
      return;
    }
    if (recognizer.current !== recognition) return;
    finishTimer.current = setTimeout(() => {
      if (recognizer.current !== recognition) return;
      cancel();
      callbacks.current.onError('Speech recognition took too long to finish. Review the text already captured.');
    }, 5000);
  }, [cancel, clearTimers]);

  const start = () => {
    if (recognizer.current) return;
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) {
      callbacks.current.onError('Speech-to-text is unavailable in this browser. Try Chrome, or type your message.');
      return;
    }
    let heard = false;
    try {
      const recognition = new Constructor();
      recognizer.current = recognition;
      const current = () => active.current && recognizer.current === recognition;
      recognition.lang = LOCALES[language];
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        if (!current()) { recognition.abort(); return; }
        setStatus('recording');
        const began = Date.now();
        interval.current = setInterval(() => setSeconds(Math.min(60, Math.floor((Date.now() - began) / 1000))), 250);
        deadline.current = setTimeout(stop, 60000);
      };
      recognition.onresult = (event) => {
        if (!current()) return;
        const transcript = Array.from(event.results, (result) => result[0]?.transcript ?? '').join(' ').trim();
        heard = heard || !!transcript;
        callbacks.current.onText(transcript);
      };
      recognition.onerror = (event) => {
        if (!current()) return;
        cancel();
        callbacks.current.onError(ERRORS[event.error] || 'Speech recognition failed. Please try again or type your message.');
      };
      recognition.onend = () => {
        if (!current()) return;
        recognizer.current = null;
        clearTimers();
        setStatus('idle');
        if (!heard) callbacks.current.onError(ERRORS['no-speech']);
      };
      setSeconds(0);
      setStatus('permission');
      recognition.start();
    } catch {
      cancel();
      callbacks.current.onError('Speech recognition could not start. Check microphone access, or type your message.');
    }
  };

  return { status, seconds, start, stop, cancel };
}
