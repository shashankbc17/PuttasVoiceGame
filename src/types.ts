export type EngineMode = 'native' | 'cloud' | 'webgpu';

export type TonePresetId = 
  | 'original'
  | 'robot'
  | 'demon'
  | 'chipmunk'
  | 'walkietalkie'
  | 'ethereal'
  | 'alien';

export interface TonePreset {
  id: TonePresetId;
  name: string;
  tag: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  iconName: string;
  pitchShift: number; // in semitones (e.g., -7 for demon, +8 for chipmunk)
  reverbAmount: number; // 0 to 1
  distortionAmount: number; // 0 to 1
  ringModFreq: number; // Hz (0 for off, e.g., 60 for robot)
  bandpassRange?: [number, number]; // [lowHz, highHz] for radio/walkie-talkie
}

export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
  ttsLang: string;
}

export type AppStatus = 
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'translating'
  | 'synthesizing'
  | 'modulating'
  | 'playing'
  | 'error';

export interface ProcessedAudio {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  sourceLang: Language;
  targetLang: Language;
  appliedTone: TonePresetId;
  audioBlobUrl?: string;
  durationSec?: number;
}

export interface CloudConfig {
  provider: 'gemini' | 'openai';
  apiKey: string;
  model: string;
}

export interface WorkerProgress {
  status: 'init' | 'downloading' | 'loading' | 'ready' | 'processing' | 'done' | 'error';
  progress?: number;
  file?: string;
  message?: string;
}
