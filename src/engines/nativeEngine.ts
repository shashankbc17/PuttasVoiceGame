import type { Language } from '../types';

// Web Speech API interface declarations for TypeScript
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface IWindow extends Window {
  SpeechRecognition?: { new (): ISpeechRecognition };
  webkitSpeechRecognition?: { new (): ISpeechRecognition };
}

export class NativeEngine {
  private recognition: ISpeechRecognition | null = null;
  private isListening = false;

  // Check if browser/tablet has native speech recognition
  public isSupported(): boolean {
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  // Listen to microphone and stream interim + final transcript
  public startSpeechRecognition(
    langCode: string,
    onResult: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void
  ): () => void {
    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      onError('Speech Recognition is not supported in this browser. Please use Chrome on Android.');
      return () => {};
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
    }

    const recognition = new SpeechRec();
    this.recognition = recognition;
    this.isListening = true;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langCode;

    let finalTranscript = '';

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = (finalTranscript + ' ' + interimTranscript).trim();
      onResult(currentText, false);
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError(event.error || 'Speech recognition error');
      }
    };

    recognition.onend = () => {
      this.isListening = false;
      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim(), true);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      onError((e as Error).message);
    }

    return () => {
      this.stop();
      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim(), true);
      }
    };
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
  }

  // Translate text between languages using Google's public translation endpoint
  public async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    if (!text.trim()) return '';
    if (sourceLang === targetLang) return text;

    try {
      // Fast, free public Google Translate API (used in web apps without server)
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Translation request failed');
      const data = await res.json();
      
      // Response format: [[["Translated text", "Original text", ...]]]
      if (data && data[0]) {
        const translated = data[0].map((item: unknown[]) => item[0]).join('');
        return translated;
      }
      return text;
    } catch {
      // Fallback: MyMemory Translation API
      try {
        const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
        const fbRes = await fetch(fallbackUrl);
        const fbData = await fbRes.json();
        if (fbData?.responseData?.translatedText) {
          return fbData.responseData.translatedText;
        }
      } catch {
        // Return original if both fail
      }
      return text;
    }
  }

  // Synthesize speech using Google/Android TTS and return playable audio stream
  public async speakText(
    text: string,
    lang: Language,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (!window.speechSynthesis) {
      throw new Error('SpeechSynthesis not supported');
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang.ttsLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best matching voice on device
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(lang.code) || v.lang === lang.ttsLang);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      onEnd?.();
    };

    utterance.onerror = () => {
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  // Synthesize audio to AudioBuffer (using Google TTS audio stream for DSP modulation)
  public async synthesizeToAudioBuffer(
    text: string,
    lang: Language,
    ctx: AudioContext
  ): Promise<AudioBuffer> {
    // We fetch Google Translate TTS audio mp3 directly
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang.code}&client=tw-ob`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS fetch error');
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch {
      // If CORS or offline, create a synthetic voice waveform buffer as fallback
      return this.generateSyntheticVocalBuffer(text, ctx);
    }
  }

  // Algorithmic speech phonetic sound generator fallback
  private generateSyntheticVocalBuffer(text: string, ctx: AudioContext): AudioBuffer {
    const duration = Math.max(1, text.length * 0.08);
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;
    const baseFreq = 140; // Fundamental vocal frequency

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Speech syllable modulation envelope
      const envelope = 0.5 + 0.5 * Math.sin(t * 8 * Math.PI);
      const freq = baseFreq + 20 * Math.sin(t * 3);
      phase += (2 * Math.PI * freq) / sampleRate;

      // Vocal buzz with harmonic overtones
      const sample =
        0.6 * Math.sin(phase) +
        0.25 * Math.sin(phase * 2) +
        0.15 * Math.sin(phase * 3);

      data[i] = sample * envelope * 0.4;
    }

    return buffer;
  }
}

export const nativeEngine = new NativeEngine();
