import { pipeline, env } from '@huggingface/transformers';

// Configure environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Define pipeline type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;
let isLoading = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data;

  if (type === 'load') {
    if (transcriber) {
      self.postMessage({ type: 'ready' });
      return;
    }
    if (isLoading) return;

    isLoading = true;
    try {
      // Check if WebGPU is available in worker context
      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

      self.postMessage({
        type: 'status',
        message: hasWebGPU ? 'Initializing WebGPU acceleration...' : 'WebGPU not detected, using WASM...',
      });

      transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny',
        {
          device: hasWebGPU ? 'webgpu' : 'wasm',
          dtype: hasWebGPU ? 'fp16' : 'q4',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          progress_callback: (prog: any) => {
            if (prog.status === 'progress') {
              self.postMessage({
                type: 'progress',
                file: prog.file,
                progress: Math.round(prog.progress || 0),
              });
            }
          },
        }
      );

      isLoading = false;
      self.postMessage({ type: 'ready' });
    } catch (err) {
      isLoading = false;
      self.postMessage({
        type: 'error',
        error: (err as Error).message || 'Failed to initialize Whisper model',
      });
    }
  }

  if (type === 'transcribe') {
    const { audioData } = data; // Float32Array at 16kHz
    if (!transcriber) {
      self.postMessage({ type: 'error', error: 'Model is not loaded yet' });
      return;
    }

    try {
      self.postMessage({ type: 'status', message: 'Neural processing audio...' });
      const output = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const text = Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text;
      self.postMessage({ type: 'transcribe_result', text: text.trim() });
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: (err as Error).message || 'Transcription failed',
      });
    }
  }
};
