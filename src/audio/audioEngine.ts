import type { TonePresetId } from '../types';
import { TONE_PRESETS } from '../constants/presets';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  public analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private activeAudioElement: HTMLAudioElement | null = null;
  private speechSimOsc: OscillatorNode | null = null;
  private speechSimGain: GainNode | null = null;

  public startSpeechVisualizer(): void {
    const ctx = this.initContext();
    if (!this.analyser) return;

    this.stopSpeechVisualizer();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);

    osc.connect(gain);
    // Connect to analyser only (NOT to destination) so visualizer dances while TTS speaks
    gain.connect(this.analyser);
    osc.start();

    this.speechSimOsc = osc;
    this.speechSimGain = gain;
  }

  public stopSpeechVisualizer(): void {
    if (this.speechSimOsc) {
      try {
        this.speechSimOsc.stop();
        this.speechSimOsc.disconnect();
      } catch {
        // Ignore
      }
      this.speechSimOsc = null;
    }
    if (this.speechSimGain) {
      try {
        this.speechSimGain.disconnect();
      } catch {
        // Ignore
      }
      this.speechSimGain = null;
    }
  }

  public initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 44100 });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
    }
    return this.ctx;
  }

  public getContext(): AudioContext {
    return this.initContext();
  }

  // Start microphone stream with real-time analyser connection
  public async startRecording(): Promise<void> {
    const ctx = this.initContext();
    this.recordedChunks = [];

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.micSource = ctx.createMediaStreamSource(this.micStream);
    if (this.analyser) {
      this.micSource.connect(this.analyser);
    }

    // Capture audio blob via MediaRecorder with mobile-safe candidate detection
    try {
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
      ];
      let selectedMime = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const type of candidates) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedMime = type;
            break;
          }
        }
      }
      this.mediaRecorder = selectedMime
        ? new MediaRecorder(this.micStream, { mimeType: selectedMime })
        : new MediaRecorder(this.micStream);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.micStream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100);
  }

  // Stop recording and return captured audio Blob and AudioBuffer
  public async stopRecording(): Promise<{ blob: Blob; buffer: AudioBuffer; float32: Float32Array }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          
          // Cleanup mic tracks
          if (this.micStream) {
            this.micStream.getTracks().forEach((t) => t.stop());
            this.micStream = null;
          }
          if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
          }

          if (this.recordedChunks.length === 0 || blob.size < 100) {
            reject(new Error('Audio clip was too short. Speak for at least 1-2 seconds.'));
            return;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const ctx = this.getContext();
          const buffer = await ctx.decodeAudioData(arrayBuffer);

          // Extract single-channel 16kHz float32 audio for speech recognition
          const float32 = this.resampleTo16kHz(buffer);

          resolve({ blob, buffer, float32 });
        } catch (err) {
          reject(err);
        }
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        reject(new Error('Recording was not active'));
      }
    });
  }

  // Resample any audio buffer to mono 16kHz required by Whisper / Transformers.js
  public resampleTo16kHz(audioBuffer: AudioBuffer): Float32Array {
    const targetSampleRate = 16000;
    const sourceSampleRate = audioBuffer.sampleRate;
    const sourceData = audioBuffer.getChannelData(0);

    if (sourceSampleRate === targetSampleRate) {
      return sourceData;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const targetLength = Math.round(sourceData.length / ratio);
    const result = new Float32Array(targetLength);

    for (let i = 0; i < targetLength; i++) {
      const originalIndex = Math.min(Math.floor(i * ratio), sourceData.length - 1);
      result[i] = sourceData[originalIndex];
    }

    return result;
  }

  // Generate an impulse response buffer for algorithmic reverb
  private createImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const factor = Math.pow(n / length, decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }

    return impulse;
  }

  // Distortion curve for WaveShaperNode
  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount * 100;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;

    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Granular pitch shifter graph (Twin modulated delay line with 180° crossfade)
  public setupPitchShifter(
    ctx: BaseAudioContext,
    input: AudioNode,
    output: AudioNode,
    semitones: number
  ) {
    if (semitones === 0) {
      input.connect(output);
      return;
    }

    // Pitch ratio: 2^(semitones / 12)
    const pitchRatio = Math.pow(2, semitones / 12);
    const bufferTime = 0.08; // 80ms grain buffer
    const modPeriod = bufferTime / Math.abs(pitchRatio - 1);
    const modFreq = 1 / Math.max(modPeriod, 0.01);

    // Twin delay lines
    const delay1 = ctx.createDelay(1.0);
    const delay2 = ctx.createDelay(1.0);

    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    // LFO modulators for grain ramping
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(modFreq, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(pitchRatio < 1 ? bufferTime : -bufferTime, ctx.currentTime);

    // Crossfade envelopes
    const modOsc1 = ctx.createOscillator();
    modOsc1.type = 'sine';
    modOsc1.frequency.setValueAtTime(modFreq, ctx.currentTime);

    delay1.delayTime.setValueAtTime(bufferTime / 2, ctx.currentTime);
    delay2.delayTime.setValueAtTime(bufferTime / 2, ctx.currentTime);

    input.connect(delay1);
    input.connect(delay2);

    delay1.connect(gain1);
    delay2.connect(gain2);

    gain1.gain.setValueAtTime(0.5, ctx.currentTime);
    gain2.gain.setValueAtTime(0.5, ctx.currentTime);

    gain1.connect(output);
    gain2.connect(output);
  }

  // Apply full DSP modulation chain to an AudioBuffer and render to WAV Blob
  public async renderModulatedAudio(
    sourceBuffer: AudioBuffer,
    toneId: TonePresetId
  ): Promise<{ blob: Blob; url: string; buffer: AudioBuffer }> {
    const preset = TONE_PRESETS.find((p) => p.id === toneId) || TONE_PRESETS[0];
    const duration = sourceBuffer.duration + (preset.reverbAmount > 0.3 ? 1.5 : 0.5);

    const offlineCtx = new OfflineAudioContext(
      sourceBuffer.numberOfChannels,
      Math.ceil(offlineCtxSampleRate(sourceBuffer.sampleRate) * duration),
      sourceBuffer.sampleRate
    );

    // Source
    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;

    // Pitch shift layer
    let pitchShiftedNode: AudioNode;
    if (preset.pitchShift !== 0) {
      const pitchTarget = offlineCtx.createGain();
      // Apply playbackRate compensation if needed or granular pitch
      source.playbackRate.setValueAtTime(Math.pow(2, preset.pitchShift / 12), 0);
      source.connect(pitchTarget);
      pitchShiftedNode = pitchTarget;
    } else {
      pitchShiftedNode = source;
    }

    let currentNode: AudioNode = pitchShiftedNode;

    // Tone: Ring Modulation (Cyborg / Alien)
    if (preset.ringModFreq > 0) {
      const ringOsc = offlineCtx.createOscillator();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(preset.ringModFreq, 0);

      const ringGain = offlineCtx.createGain();
      ringGain.gain.setValueAtTime(0, 0);
      ringOsc.connect(ringGain.gain);

      currentNode.connect(ringGain);
      ringOsc.start(0);
      currentNode = ringGain;
    }

    // Tone: Bandpass Filter (Walkie-Talkie / Lo-Fi)
    if (preset.bandpassRange) {
      const hp = offlineCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(preset.bandpassRange[0], 0);

      const lp = offlineCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(preset.bandpassRange[1], 0);

      currentNode.connect(hp);
      hp.connect(lp);
      currentNode = lp;
    }

    // Tone: Demon Sub-bass or Chipmunk Treble boost
    if (preset.id === 'demon') {
      const lowShelf = offlineCtx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.setValueAtTime(100, 0);
      lowShelf.gain.setValueAtTime(9, 0); // +9dB deep rumble
      currentNode.connect(lowShelf);
      currentNode = lowShelf;
    } else if (preset.id === 'chipmunk') {
      const highShelf = offlineCtx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(3500, 0);
      highShelf.gain.setValueAtTime(7, 0);
      currentNode.connect(highShelf);
      currentNode = highShelf;
    }

    // Tone: Distortion / Drive
    if (preset.distortionAmount > 0) {
      const distortion = offlineCtx.createWaveShaper();
      distortion.curve = this.makeDistortionCurve(preset.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
      distortion.oversample = '4x';
      currentNode.connect(distortion);
      currentNode = distortion;
    }

    // Tone: Reverb & Spatial Reflections
    if (preset.reverbAmount > 0.05) {
      const convolver = offlineCtx.createConvolver();
      convolver.buffer = this.createImpulseResponse(
        offlineCtx,
        preset.reverbAmount * 3,
        preset.id === 'demon' ? 1.5 : 2.5
      );

      const dryGain = offlineCtx.createGain();
      const wetGain = offlineCtx.createGain();

      dryGain.gain.setValueAtTime(1 - preset.reverbAmount * 0.4, 0);
      wetGain.gain.setValueAtTime(preset.reverbAmount * 0.9, 0);

      currentNode.connect(dryGain);
      currentNode.connect(convolver);
      convolver.connect(wetGain);

      const mixGain = offlineCtx.createGain();
      dryGain.connect(mixGain);
      wetGain.connect(mixGain);
      currentNode = mixGain;
    }

    // Master Limiter to prevent clipping
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-2, 0);
    compressor.knee.setValueAtTime(10, 0);
    compressor.ratio.setValueAtTime(12, 0);
    compressor.attack.setValueAtTime(0.003, 0);
    compressor.release.setValueAtTime(0.15, 0);

    currentNode.connect(compressor);
    compressor.connect(offlineCtx.destination);

    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWav(renderedBuffer);
    const url = URL.createObjectURL(wavBlob);

    return { blob: wavBlob, url, buffer: renderedBuffer };
  }

  // Play an AudioBuffer with live visualizer feed
  public playBuffer(buffer: AudioBuffer, onEnded?: () => void): void {
    const ctx = this.initContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (this.analyser) {
      source.connect(this.analyser);
      this.analyser.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }

    source.onended = () => {
      onEnded?.();
    };

    source.start(0);
  }

  // Play audio from a Blob URL
  public playUrl(url: string, onEnded?: () => void): void {
    if (this.activeAudioElement) {
      this.activeAudioElement.pause();
      this.activeAudioElement = null;
    }

    const audio = new Audio(url);
    this.activeAudioElement = audio;

    const ctx = this.initContext();
    try {
      const source = ctx.createMediaElementSource(audio);
      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }
    } catch {
      // Audio element might already be connected
    }

    audio.onended = () => {
      onEnded?.();
    };

    audio.play();
  }

  public stopPlayback(): void {
    if (this.activeAudioElement) {
      this.activeAudioElement.pause();
      this.activeAudioElement = null;
    }
  }
}

function offlineCtxSampleRate(rate: number): number {
  return rate || 44100;
}

// Convert AudioBuffer to standard 16-bit PCM WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // Write WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave and write 16-bit PCM samples
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const audioEngine = new AudioEngine();
