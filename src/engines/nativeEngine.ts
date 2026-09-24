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

    // Use continuous: false for maximum responsiveness on Android tablets
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = langCode;

    let receivedText = '';

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          receivedText = item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const current = (receivedText || interim).trim();
      if (current) {
        onResult(current, false);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        onError('No speech detected. Please speak closer to the mic.');
      } else if (event.error === 'not-allowed') {
        onError('Microphone permission denied. Please allow microphone access in Chrome settings.');
      } else if (event.error !== 'aborted') {
        onError(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      this.isListening = false;
      if (receivedText.trim()) {
        onResult(receivedText.trim(), true);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      onError((e as Error).message);
    }

    return () => {
      this.stop();
      if (receivedText.trim()) {
        onResult(receivedText.trim(), true);
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
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Translation request failed');
      const data = await res.json();
      
      if (data && data[0]) {
        const translated = data[0].map((item: unknown[]) => item[0]).join('');
        return translated;
      }
      return text;
    } catch {
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

  // Speak real human words with acoustic vocal tone modulation
  public speakWithTone(
    text: string,
    lang: Language,
    toneId: string,
    onStart?: () => void,
    onEnd?: () => void
  ): void {
    if (!window.speechSynthesis) {
      throw new Error('SpeechSynthesis not supported on this device');
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang.ttsLang;

    // Apply vocal tone character presets
    switch (toneId) {
      case 'demon':
        utterance.pitch = 0.25; // Deep sub-bass growl
        utterance.rate = 0.8;   // Slow menacing cadence
        break;
      case 'chipmunk':
        utterance.pitch = 1.95; // High-pitched squeak
        utterance.rate = 1.35;  // Hyper fast
        break;
      case 'robot':
        utterance.pitch = 0.55; // Monotone robot
        utterance.rate = 0.95;
        break;
      case 'walkietalkie':
        utterance.pitch = 1.05;
        utterance.rate = 1.15;
        break;
      case 'ethereal':
        utterance.pitch = 1.35; // Airy high whisper
        utterance.rate = 0.75;  // Slow dreamy tempo
        break;
      case 'alien':
        utterance.pitch = 1.7;  // High alien screech
        utterance.rate = 1.0;
        break;
      default:
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
        break;
    }

    // Pick best matching voice on device
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(
      (v) => v.lang === lang.ttsLang || v.lang.startsWith(lang.code)
    );
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

  public stopSpeaking(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const nativeEngine = new NativeEngine();
