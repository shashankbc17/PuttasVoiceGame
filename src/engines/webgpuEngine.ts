import type { WorkerProgress } from '../types';

export class WebGpuEngine {
  private worker: Worker | null = null;
  private isModelReady = false;
  private onProgressCallback: ((progress: WorkerProgress) => void) | null = null;
  private pendingTranscribeResolve: ((text: string) => void) | null = null;
  private pendingTranscribeReject: ((err: Error) => void) | null = null;

  public init(onProgress?: (progress: WorkerProgress) => void): void {
    if (this.worker) return;

    if (onProgress) {
      this.onProgressCallback = onProgress;
    }

    // Initialize Web Worker with Vite's native worker loader
    this.worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (e: MessageEvent) => {
      const { type, message, progress, file, error, text } = e.data;

      if (type === 'progress') {
        this.onProgressCallback?.({
          status: 'downloading',
          progress,
          file,
        });
      } else if (type === 'status') {
        this.onProgressCallback?.({
          status: 'loading',
          message,
        });
      } else if (type === 'ready') {
        this.isModelReady = true;
        this.onProgressCallback?.({
          status: 'ready',
          message: 'Whisper Neural Engine Ready on WebGPU',
        });
      } else if (type === 'transcribe_result') {
        if (this.pendingTranscribeResolve) {
          this.pendingTranscribeResolve(text);
          this.pendingTranscribeResolve = null;
          this.pendingTranscribeReject = null;
        }
      } else if (type === 'error') {
        this.onProgressCallback?.({
          status: 'error',
          message: error,
        });
        if (this.pendingTranscribeReject) {
          this.pendingTranscribeReject(new Error(error));
          this.pendingTranscribeResolve = null;
          this.pendingTranscribeReject = null;
        }
      }
    };

    // Trigger initial load
    this.worker.postMessage({ type: 'load' });
  }

  public getIsReady(): boolean {
    return this.isModelReady;
  }

  public setProgressCallback(cb: (progress: WorkerProgress) => void): void {
    this.onProgressCallback = cb;
  }

  public async transcribeAudio(audioFloat32: Float32Array): Promise<string> {
    if (!this.worker) {
      this.init();
    }

    return new Promise((resolve, reject) => {
      this.pendingTranscribeResolve = resolve;
      this.pendingTranscribeReject = reject;

      this.worker?.postMessage({
        type: 'transcribe',
        data: { audioData: audioFloat32 },
      });
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isModelReady = false;
    }
  }
}

export const webGpuEngine = new WebGpuEngine();
