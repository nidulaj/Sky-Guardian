import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVoiceRecorder } from '@/components/voice/useVoiceRecorder';

afterEach(() => vi.unstubAllGlobals());

describe('Microphone lifecycle', () => {
  it('releases a microphone granted after cancellation', async () => {
    let grant!: (stream: MediaStream) => void;
    const stopTrack = vi.fn();
    const microphone = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    vi.stubGlobal('MediaRecorder', class {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => new Promise<MediaStream>((done) => { grant = done; })) } });
    const onRecording = vi.fn();
    const { result } = renderHook(() => useVoiceRecorder(onRecording, vi.fn()));
    let pending!: Promise<void>;
    act(() => { pending = result.current.start(); });
    act(() => result.current.cancel());
    await act(async () => { grant(microphone); await pending; });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(onRecording).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('stops tracks and returns recorded audio exactly once', async () => {
    const stopTrack = vi.fn();
    const microphone = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    class Recorder {
      static isTypeSupported() { return true; }
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', Recorder);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(microphone) } });
    const onRecording = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceRecorder(onRecording, vi.fn()));
    await act(async () => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('recording'));
    act(() => result.current.stop());
    expect(onRecording).toHaveBeenCalledOnce();
    expect(onRecording.mock.calls[0][0].size).toBe(5);
    expect(stopTrack).toHaveBeenCalledOnce();
    unmount();
    expect(onRecording).toHaveBeenCalledOnce();
  });
});
