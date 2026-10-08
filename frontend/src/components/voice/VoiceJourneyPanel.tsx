'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ChevronDown, Loader2, Mic, RotateCcw, Send, Square, Volume2, X } from 'lucide-react';
import { getVoiceBriefing, getVoiceConfig, interpretVoiceText, transcribeVoice } from '@/lib/api/voice';
import type { FlightLegInput, JourneyAnalysisResponse } from '@/types/journey';
import type { VoiceConfig, VoiceDraft, VoiceLanguage } from '@/types/voice';
import { useVoiceRecorder } from './useVoiceRecorder';

const LANGUAGES: { code: VoiceLanguage; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'si', label: 'Sinhala' }, { code: 'ta', label: 'Tamil' },
];
const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink/20 text-ink hover:bg-ink/5 disabled:opacity-40 disabled:cursor-not-allowed';

interface Props {
  language: VoiceLanguage;
  onLanguageChange: (language: VoiceLanguage) => void;
  onDraft: (legs: FlightLegInput[]) => void;
  analysis: JourneyAnalysisResponse | null;
  disabled?: boolean;
}

export default function VoiceJourneyPanel({ language, onLanguageChange, onDraft, analysis, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [checking, setChecking] = useState(false);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'input' | 'briefing' | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; language: VoiceLanguage } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  const url = useRef<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const operation = useRef(0);
  const deviceSpeaking = useRef(false);

  const clearAudio = useCallback(() => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setAudioUrl(null);
    if (deviceSpeaking.current && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    deviceSpeaking.current = false;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      if (deviceSpeaking.current && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    operation.current++;
    controller.current?.abort();
    setBusy(null);
    clearAudio();
    setBriefing(null);
  }, [analysis, language, clearAudio]);

  const request = () => {
    controller.current?.abort();
    controller.current = new AbortController();
    return { signal: controller.current.signal, id: ++operation.current };
  };
  const current = (id: number) => active.current && operation.current === id;

  const checkConfig = async () => {
    setChecking(true);
    setError(null);
    const { signal, id } = request();
    try {
      const response = await getVoiceConfig(signal);
      if (current(id)) setConfig(response);
    } catch (err) {
      if (current(id) && !signal.aborted) setError(err instanceof Error ? err.message : 'Voice is unavailable.');
    } finally {
      if (current(id)) setChecking(false);
    }
  };

  const readBriefing = async () => {
    if (!analysis) { setNotice('Check a journey first to hear its assessment.'); return; }
    clearAudio();
    setError(null);
    setNotice(null);
    setBusy('briefing');
    const { signal, id } = request();
    try {
      const response = await getVoiceBriefing(analysis, language, signal);
      if (!current(id)) return;
      setBriefing({ text: response.text, language: response.language });
      if (response.audio_base64 && response.audio_mime_type) {
        const bytes = Uint8Array.from(atob(response.audio_base64), (c) => c.charCodeAt(0));
        url.current = URL.createObjectURL(new Blob([bytes], { type: response.audio_mime_type }));
        setAudioUrl(url.current);
      } else {
        setNotice('Generated audio is unavailable. The written briefing remains available.');
      }
      if (response.language !== language) setNotice('Translation is unavailable. This briefing is in English.');
    } catch (err) {
      if (current(id) && !signal.aborted) setError(err instanceof Error ? err.message : 'The briefing is unavailable.');
    } finally {
      if (current(id)) setBusy(null);
    }
  };

  const processInput = async (recording?: Blob) => {
    setError(null);
    setNotice(null);
    setDraft(null);
    clearAudio();
    setBusy('input');
    const { signal, id } = request();
    try {
      const response = recording
        ? await transcribeVoice(recording, language, signal)
        : await interpretVoiceText(text.trim(), language, signal);
      if (!current(id)) return;
      setText(response.transcript);
      setDraft(response);
      if (response.intent === 'read_summary') { void readBriefing(); return; }
      if (response.intent === 'unsupported') setNotice('Describe your flights, or ask to hear the current journey assessment.');
    } catch (err) {
      if (current(id) && !signal.aborted) setError(err instanceof Error ? err.message : 'The recording could not be processed.');
    } finally {
      if (current(id)) setBusy(null);
    }
  };

  const recorder = useVoiceRecorder((blob) => void processInput(blob), setError);
  useEffect(() => {
    if (!disabled) return;
    recorder.cancel();
    controller.current?.abort();
    operation.current++;
    setBusy(null);
    setChecking(false);
    clearAudio();
  }, [disabled, recorder.cancel, clearAudio]);
  const recording = recorder.status !== 'idle';
  const locked = disabled || !!busy || recording || checking;

  const applyDraft = () => {
    if (!draft?.legs.length) return;
    onDraft(draft.legs.map((leg) => ({
      flight_number: leg.flight_number ?? '', origin: leg.origin ?? '',
      destination: leg.destination ?? '', travel_date: leg.travel_date ?? '',
    })));
    setNotice('Flight details added. Review the form before checking your journey.');
  };

  const speakLocally = () => {
    if (speaking) { speechSynthesis.cancel(); deviceSpeaking.current = false; setSpeaking(false); return; }
    if (!briefing || typeof speechSynthesis === 'undefined') return;
    const locales = { en: 'en', si: 'si', ta: 'ta' };
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(locales[briefing.language]));
    if (!voice) { setNotice('Your device has no voice for this language. The written briefing is available below.'); return; }
    const utterance = new SpeechSynthesisUtterance(briefing.text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.onend = utterance.onerror = () => { deviceSpeaking.current = false; if (active.current) setSpeaking(false); };
    deviceSpeaking.current = true;
    setSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  const close = () => {
    recorder.cancel();
    controller.current?.abort();
    operation.current++;
    setBusy(null);
    setChecking(false);
    clearAudio();
    setOpen(false);
  };

  return (
    <section aria-labelledby="voice-title" className="mb-6 border-y border-ink/15 py-4">
      <button type="button" className="flex min-h-11 w-full items-center gap-3 text-left text-ink"
        aria-expanded={open} aria-controls="voice-panel" onClick={() => {
          if (open) close();
          else { setOpen(true); void checkConfig(); }
        }}>
        <Mic className="h-5 w-5 text-coral" aria-hidden="true" />
        <span id="voice-title" className="flex-1 font-semibold">Voice assistant</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div id="voice-panel" className="mt-4 min-w-0 space-y-4">
        <div role="group" aria-label="Voice language" className="grid grid-cols-3 gap-1 rounded-md border border-ink/15 p-1">
          {LANGUAGES.map((item) => <button key={item.code} type="button" aria-pressed={language === item.code}
            disabled={locked} onClick={() => { onLanguageChange(item.code); setDraft(null); setNotice(null); }}
            className={`min-h-10 rounded px-2 text-sm disabled:opacity-50 ${language === item.code ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'}`}>
            {item.label}
          </button>)}
        </div>

        {checking && <p role="status" className="text-sm text-ink-muted">Connecting to voice service...</p>}
        {config && !config.available && <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-ink-soft">Voice input is currently unavailable. You can enter your flights below.</p>
          <button type="button" className={iconButton} disabled={locked} title="Retry voice connection" aria-label="Retry voice connection" onClick={() => void checkConfig()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>}

        <div className="flex items-center gap-3">
          <button type="button" className={`${iconButton} ${recording ? 'border-status-danger text-status-danger' : ''}`}
            aria-label={recording ? 'Stop recording' : 'Record journey'} title={recording ? 'Stop recording' : 'Record journey'}
            disabled={disabled || !!busy || checking || !config?.available || recorder.status === 'permission'}
            onClick={() => { if (recording) recorder.stop(); else { setError(null); clearAudio(); void recorder.start(); } }}>
            {recorder.status === 'permission' ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <p role="status" aria-live="polite" className="min-w-0 flex-1 text-sm text-ink-soft">
            {recorder.status === 'permission' ? 'Waiting for microphone access...' : recording ? `Recording ${String(recorder.seconds).padStart(2, '0')} / 60 seconds` : busy === 'input' ? 'Understanding your journey...' : busy === 'briefing' ? 'Preparing your briefing...' : 'Ready'}
          </p>
          {(busy || recording) && <button type="button" className={iconButton} title="Cancel voice request" aria-label="Cancel voice request" onClick={() => {
            recorder.cancel(); controller.current?.abort(); operation.current++; setBusy(null);
          }}><X className="h-4 w-4" aria-hidden="true" /></button>}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); if (text.trim() && !locked && config?.available) void processInput(); }}>
          <label htmlFor="voice-transcript" className="block text-sm font-medium text-ink">Journey description</label>
          <textarea id="voice-transcript" value={text} maxLength={4000} rows={3} disabled={locked}
            onChange={(event) => { setText(event.target.value); setDraft(null); }}
            placeholder="UL001 from CMB to KUL on 20 October 2026..."
            className="mt-2 block w-full resize-y rounded-md border border-ink/20 bg-white p-3 text-base text-ink focus:border-coral focus:outline-none disabled:opacity-50" />
          <div className="mt-2 flex justify-end">
            <button type="submit" className={iconButton} title="Interpret journey description" aria-label="Interpret journey description"
              disabled={locked || !text.trim() || !config?.available}><Send className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </form>

        {draft?.intent === 'analyze_journey' && draft.legs.length > 0 && <div className="space-y-3 border-t border-ink/10 pt-4">
          <h3 className="text-sm font-semibold text-ink">Journey draft</h3>
          <ol className="divide-y divide-ink/10">
            {draft.legs.map((leg, index) => <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm text-ink">
              <span className="font-medium">{leg.flight_number || 'Flight number needed'}: {leg.origin || '?'} to {leg.destination || '?'}</span>
              <span className="text-ink-muted">{leg.travel_date || 'Date needed'}</span>
            </li>)}
          </ol>
          {draft.missing_fields.length > 0 && <p className="text-sm text-status-caution">Missing: {draft.missing_fields.join('; ')}.</p>}
          <button type="button" disabled={locked} onClick={applyDraft}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />Use these flight details
          </button>
        </div>}
        {draft?.warnings.map((warning) => <p key={warning} className="text-sm text-ink-soft">{warning}</p>)}

        {analysis && <div className="border-t border-ink/10 pt-4">
          <button type="button" disabled={locked} onClick={() => void readBriefing()}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink disabled:opacity-50">
            <Volume2 className="h-4 w-4" aria-hidden="true" />Prepare spoken assessment
          </button>
        </div>}
        {briefing && <div className="space-y-3">
          <p lang={briefing.language} className="break-words text-sm leading-relaxed text-ink-soft">{briefing.text}</p>
          {audioUrl ? <audio ref={audio} controls src={audioUrl} aria-label="Spoken journey assessment" className="block h-12 w-full min-w-0"
            onError={() => { clearAudio(); setNotice('Audio playback failed. The written briefing remains available.'); }} />
            : <button type="button" onClick={speakLocally} disabled={typeof window !== 'undefined' && !('speechSynthesis' in window)}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink disabled:opacity-50">
              {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{speaking ? 'Stop reading' : 'Read with device voice'}
            </button>}
        </div>}
        {notice && <p role="status" className="text-sm text-ink-soft">{notice}</p>}
        {error && <p role="alert" className="break-words text-sm text-status-danger">{error}</p>}
      </div>}
    </section>
  );
}
