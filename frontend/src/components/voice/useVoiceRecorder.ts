'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useVoiceRecorder(onRecording: (blob: Blob) => void, onError: (message: string) => void) {
  const [status, setStatus] = useState<'idle' | 'permission' | 'recording'>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);
  const callbacks = useRef({ onRecording, onError });
  callbacks.current = { onRecording, onError };

  const release = useCallback(() => {
    if (interval.current) clearInterval(interval.current);
    if (deadline.current) clearTimeout(deadline.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    interval.current = deadline.current = null;
    pending.current = false;
  }, []);

  const cancel = useCallback(() => {
    generation.current++;
    if (recorder.current) {
      recorder.current.ondataavailable = null;
      recorder.current.onstop = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    release();
    if (active.current) setStatus('idle');
  }, [release]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; cancel(); };
  }, [cancel]);

  const start = async () => {
    if (pending.current || recorder.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      callbacks.current.onError('Microphone recording is unavailable in this browser. Type your journey instead.');
      return;
    }
    pending.current = true;
    const id = ++generation.current;
    setStatus('permission');
    setSeconds(0);
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current || !pending.current || generation.current !== id) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = microphone;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(microphone, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: Blob[] = [];
      let bytes = 0;
      recording.ondataavailable = (event) => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes > 8 * 1024 * 1024) {
          cancel();
          callbacks.current.onError('The recording is too large. Please record a shorter description.');
        }
      };
      recording.onerror = () => {
        cancel();
        callbacks.current.onError('Recording failed. Please try again or type your journey.');
      };
      recording.onstop = () => {
        recorder.current = null;
        release();
        if (!active.current) return;
        setStatus('idle');
        const blob = new Blob(chunks, { type: recording.mimeType || 'audio/webm' });
        if (blob.size) callbacks.current.onRecording(blob);
        else callbacks.current.onError('No audio was recorded. Please try again.');
      };
      recording.start(1000);
      setStatus('recording');
      const began = Date.now();
      interval.current = setInterval(() => setSeconds(Math.min(60, Math.floor((Date.now() - began) / 1000))), 250);
      deadline.current = setTimeout(() => { if (recording.state === 'recording') recording.stop(); }, 60000);
    } catch (error) {
      if (generation.current !== id) return;
      cancel();
      if (!active.current) return;
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      callbacks.current.onError(denied
        ? 'Microphone access was denied. Allow microphone access in your browser, or type your journey.'
        : 'No microphone is available. Connect one, or type your journey.');
    }
  };

  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  return { status, seconds, start, stop, cancel };
}
