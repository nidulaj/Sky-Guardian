'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Loader2, Mic, Plus, RotateCcw, Send, Square, Volume2, VolumeX, X } from 'lucide-react';
import { getVoiceConfig, sendVoiceChat } from '@/lib/api/voice';
import type { FlightLegInput, JourneyAnalysisResponse } from '@/types/journey';
import type { VoiceChatReply, VoiceConfig, VoiceDraft, VoiceLanguage } from '@/types/voice';
import { useSpeechInput } from './useSpeechInput';

const LANGUAGES: { code: VoiceLanguage; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'si', label: 'Sinhala' }, { code: 'ta', label: 'Tamil' },
];
const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink/20 text-ink hover:bg-ink/5 disabled:opacity-40 disabled:cursor-not-allowed';
type Message = { id: number; role: 'user' | 'assistant'; text: string; reply?: VoiceChatReply };

interface Props {
  language: VoiceLanguage;
  onLanguageChange: (language: VoiceLanguage) => void;
  onDraft: (legs: FlightLegInput[]) => void;
  analysis: JourneyAnalysisResponse | null;
  disabled?: boolean;
}

function ReplyAudio({ reply, autoSpeak, onPlay }: {
  reply: VoiceChatReply; autoSpeak: boolean; onPlay: (audio: HTMLAudioElement) => void;
}) {
  const [src, setSrc] = useState<string>();
  const [notice, setNotice] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!reply.audio_base64 || !reply.audio_mime_type) return;
    const bytes = Uint8Array.from(atob(reply.audio_base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: reply.audio_mime_type }));
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [reply]);
  useEffect(() => {
    if (!autoSpeak) { player.current?.pause(); return; }
    if (src && player.current) void player.current.play().catch(() => setNotice('Press play to hear this reply.'));
  }, [src, autoSpeak]);
  return src ? <div className="mt-3">
    <audio ref={player} src={src} controls aria-label="Spoken reply" className="block h-10 w-full min-w-0"
      onPlay={(event) => onPlay(event.currentTarget)}
      onLoadedMetadata={() => {
        const log = player.current?.closest('[role="log"]');
        if (autoSpeak && log) log.scrollTop = log.scrollHeight;
      }}
      onError={() => setNotice('Audio playback is unavailable. Your reply is shown above.')} />
    {notice && <p className="mt-1 text-xs text-ink-muted">{notice}</p>}
  </div> : null;
}

export default function VoiceJourneyPanel({ language, onLanguageChange, onDraft, analysis, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [checking, setChecking] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [legs, setLegs] = useState<VoiceDraft['legs']>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [spokenReplyId, setSpokenReplyId] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  const operation = useRef(0);
  const nextId = useRef(1);
  const pendingUser = useRef<number | null>(null);
  const playing = useRef<HTMLAudioElement | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const dictationBase = useRef('');
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const cancelRequest = useCallback(() => {
    controller.current?.abort();
    operation.current++;
    setBusy(false);
    setChecking(false);
    playing.current?.pause();
    const pending = pendingUser.current;
    pendingUser.current = null;
    if (pending !== null) setMessages((previous) => previous.filter((item) => item.id !== pending));
  }, []);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; controller.current?.abort(); playing.current?.pause(); };
  }, []);

  const checkConfig = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++operation.current;
    setChecking(true);
    setError(null);
    try {
      const response = await getVoiceConfig(abort.signal);
      if (active.current && operation.current === id) setConfig(response);
    } catch (err) {
      if (active.current && operation.current === id && !abort.signal.aborted)
        setError(err instanceof Error ? err.message : 'Voice is unavailable.');
    } finally {
      if (active.current && operation.current === id) setChecking(false);
    }
  }, []);

  useEffect(() => { if (open && !config) void checkConfig(); }, [open, config, checkConfig]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, busy, open]);
  useEffect(() => {
    const resize = () => { if (log.current) log.current.scrollTop = log.current.scrollHeight; };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const processInput = async (message = text.trim()) => {
    if (!message) return;
    setError(null);
    setNotice(null);
    playing.current?.pause();
    setBusy(true);
    const id = ++operation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const userId = nextId.current++;
    pendingUser.current = userId;
    const history = messages.slice(-20).map(({ role, text: content }) => ({ role, text: content }));
    setMessages((previous) => [...previous.slice(-18), { id: userId, role: 'user', text: message }]);
    setText('');
    const context = { language, history, legs, analysis };
    try {
      const reply = await sendVoiceChat(message, context, abort.signal);
      if (!active.current || operation.current !== id) return;
      pendingUser.current = null;
      setLegs(reply.legs);
      const replyId = nextId.current++;
      setSpokenReplyId(replyId);
      setMessages((previous) => [
        ...previous.map((item) => item.id === userId ? { ...item, text: reply.transcript } : item),
        { id: replyId, role: 'assistant', text: reply.text, reply },
      ]);
    } catch (err) {
      if (active.current && operation.current === id && !abort.signal.aborted) {
        pendingUser.current = null;
        setError(err instanceof Error ? err.message : 'Your message could not be sent.');
        setText(message);
        setMessages((previous) => previous.filter((item) => item.id !== userId));
      }
    } finally {
      if (active.current && operation.current === id) setBusy(false);
    }
  };

  const recorder = useSpeechInput(language, (transcript) => {
    setText([dictationBase.current, transcript].filter(Boolean).join(' ').slice(0, 4000));
  }, setError);
  useEffect(() => {
    if (disabled) {
      if (recorder.status !== 'idle') setText(dictationBase.current);
      recorder.cancel(); cancelRequest();
    }
  }, [disabled, recorder.status, recorder.cancel, cancelRequest]);
  const recording = recorder.status !== 'idle';
  const locked = disabled || busy || recording || checking;

  const stop = () => {
    if (recording) setText(dictationBase.current);
    recorder.cancel();
    cancelRequest();
    setSpokenReplyId(null);
  };
  const closePanel = () => { stop(); setOpen(false); launcher.current?.focus(); };
  const newChat = () => { stop(); setMessages([]); setLegs([]); setText(''); setError(null); setNotice(null); };
  const playOne = (player: HTMLAudioElement) => {
    if (playing.current !== player) playing.current?.pause();
    playing.current = player;
  };
  const applyDraft = () => {
    onDraft(legs.map((leg) => ({ flight_number: leg.flight_number ?? '', origin: leg.origin ?? '',
      destination: leg.destination ?? '', travel_date: leg.travel_date ?? '' })));
    setNotice('Flight details added. Review the form before checking your journey.');
  };

  return <>
    <button ref={launcher} type="button" aria-label={open ? 'Hide voice assistant' : 'Open voice assistant'}
      aria-expanded={open} aria-controls="voice-panel" aria-haspopup="dialog"
      title={open ? 'Hide voice assistant' : 'Open voice assistant'}
      onClick={() => { if (open) closePanel(); else setOpen(true); }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-coral-deep px-4 text-white shadow-lg transition-colors hover:bg-ink sm:right-6 sm:px-5">
      {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Mic className="h-6 w-6" aria-hidden="true" />}
      <span className="hidden text-sm font-semibold sm:inline">Voice assistant</span>
    </button>
    {open && <section id="voice-panel" role="dialog" aria-labelledby="voice-title"
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); } }}
      className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] right-4 z-40 flex h-[min(680px,calc(100dvh-112px))] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-lg border border-ink/20 bg-sand-50 shadow-xl sm:right-6">
    <div className="flex shrink-0 items-center gap-2 border-b border-ink/15 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-ink">
        <Mic className="h-5 w-5 shrink-0 text-coral" aria-hidden="true" />
        <h2 id="voice-title" className="text-sm font-semibold">Voice assistant</h2>
      </div>
        <button type="button" className={iconButton} aria-pressed={autoSpeak} title={autoSpeak ? 'Mute spoken replies' : 'Enable spoken replies'}
          aria-label={autoSpeak ? 'Mute spoken replies' : 'Enable spoken replies'} onClick={() => {
            setAutoSpeak(!autoSpeak); playing.current?.pause();
          }}>{autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
        <button type="button" className={iconButton} title="New conversation" aria-label="New conversation" onClick={newChat}>
          <Plus className="h-4 w-4" />
        </button>
        <button ref={closeButton} type="button" className={iconButton} title="Close voice assistant" aria-label="Close voice assistant" onClick={closePanel}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
    </div>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div role="group" aria-label="Voice language" className="grid shrink-0 grid-cols-3 gap-1 rounded-md border border-ink/15 p-1">
        {LANGUAGES.map((item) => <button key={item.code} type="button" aria-pressed={language === item.code}
          disabled={locked} onClick={() => { playing.current?.pause(); onLanguageChange(item.code); }}
          className={`min-h-10 rounded px-2 text-sm disabled:opacity-50 ${language === item.code ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'}`}>
          {item.label}
        </button>)}
      </div>

      <div ref={log} role="log" aria-label="Travel conversation" aria-live="polite" aria-relevant="additions text"
        className="min-h-24 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain border-y border-ink/10 py-4 pr-2">
        <div className="max-w-[95%]">
          <p className="mb-1 text-xs font-semibold text-coral">SkyGuardian</p>
          <p className="text-sm leading-relaxed text-ink">Hi, I&apos;m SkyGuardian. Which flight can I help you with?</p>
        </div>
        {messages.map((item) => <div key={item.id} className={`min-w-0 max-w-[95%] ${item.role === 'user' ? 'ml-auto' : ''}`}>
          <p className={`mb-1 text-xs font-semibold ${item.role === 'user' ? 'text-right text-ink-muted' : 'text-coral'}`}>
            {item.role === 'user' ? 'You' : 'SkyGuardian'}
          </p>
          <div className={`min-w-0 rounded-md px-3 py-3 ${item.role === 'user' ? 'bg-ink text-white' : 'border border-ink/10 bg-white/70 text-ink'}`}>
            <p lang={item.reply?.language} className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{item.text}</p>
            {item.reply && <>
              <ReplyAudio reply={item.reply} autoSpeak={autoSpeak && item.id === spokenReplyId && !busy && !recording}
                onPlay={playOne} />
              {item.reply.sources.length > 0 && <ul aria-label="Reply sources" className="mt-3 space-y-1 border-t border-ink/10 pt-2">
                {item.reply.sources.map((source, index) => <li key={index} className="break-words text-xs text-ink-muted">
                  {source.url && /^https?:\/\//i.test(source.url)
                    ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.name}</a>
                    : source.name}
                  {source.data_mode ? ` (${source.data_mode})` : ''}{!source.verified ? ' - unverified' : ''}
                </li>)}
              </ul>}
              {item.reply.warnings.map((warning) => <p key={warning} className="mt-2 break-words text-xs text-ink-muted">{warning}</p>)}
            </>}
          </div>
        </div>)}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" />SkyGuardian is checking...
        </p>}
      </div>

      <form className="flex min-w-0 shrink-0 items-end gap-2 rounded-md border border-ink/20 bg-white p-2 focus-within:border-coral"
        onSubmit={(event) => { event.preventDefault(); if (text.trim() && !locked && config?.available) void processInput(); }}>
        <button type="button" className={`${iconButton} border-0 ${recording ? 'bg-status-danger text-white hover:bg-status-danger' : ''}`}
          aria-label={recording ? 'Stop recording' : 'Record message'} title={recording ? 'Stop dictation' : 'Dictate message'}
          disabled={disabled || busy || checking || recorder.status === 'permission' || recorder.status === 'processing'}
          onClick={() => {
            if (recording) recorder.stop();
            else { setError(null); setNotice(null); dictationBase.current = text.trim(); playing.current?.pause(); setSpokenReplyId(null); recorder.start(); }
          }}>
          {recorder.status === 'permission' || recorder.status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <label htmlFor="voice-message" className="sr-only">Message SkyGuardian</label>
        <textarea id="voice-message" value={text} maxLength={4000} rows={2} disabled={locked}
          onChange={(event) => setText(event.target.value)} placeholder="Ask about your flight..."
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); if (text.trim() && !locked && config?.available) void processInput();
            }
          }}
          className="block min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-base text-ink focus:outline-none disabled:opacity-50" />
        <button type="submit" className={`${iconButton} border-0`} title="Send message" aria-label="Send message"
          disabled={locked || !text.trim() || !config?.available}><Send className="h-4 w-4" /></button>
      </form>
      <div className="flex min-h-6 shrink-0 items-center gap-2">
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs text-ink-muted">
          {checking ? 'Connecting...' : recorder.status === 'permission' ? 'Waiting for microphone...' : recorder.status === 'processing' ? 'Finishing transcript...' : recording ? `Listening ${recorder.seconds} / 60 s` : busy ? 'Preparing reply...' : 'Ready'}
        </p>
        {(busy || recording) && <button type="button" className={iconButton} title="Cancel voice request" aria-label="Cancel voice request" onClick={stop}><X className="h-4 w-4" /></button>}
      </div>

      {legs.length > 0 && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
        <p className="text-xs text-ink-muted">{legs.length} flight{legs.length === 1 ? '' : 's'} in this conversation</p>
        <button type="button" disabled={locked} onClick={applyDraft} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink disabled:opacity-50">
          <ArrowDownToLine className="h-4 w-4" />Use these flight details
        </button>
      </div>}
      {analysis && <button type="button" disabled={locked || !config?.available} onClick={() => void processInput('Explain my displayed journey assessment.')}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink disabled:opacity-50">
        <Volume2 className="h-4 w-4" />Discuss this assessment
      </button>}
      {config && !config.available && <p className="text-sm text-ink-soft">Voice chat is currently unavailable. You can enter your flights below.</p>}
      {(error || (config && !config.available)) && <button type="button" className={iconButton} disabled={locked} title="Retry voice connection"
        aria-label="Retry voice connection" onClick={() => void checkConfig()}><RotateCcw className="h-4 w-4" /></button>}
      {notice && <p role="status" className="text-sm text-ink-soft">{notice}</p>}
      {error && <p role="alert" className="break-words text-sm text-status-danger">{error}</p>}
    </div>
  </section>}
  </>;
}
