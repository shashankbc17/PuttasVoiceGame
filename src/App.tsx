import { useState, useEffect, useRef } from 'react';
import type { EngineMode, Language, ProcessedAudio, TonePresetId, WorkerProgress } from './types';
import { LANGUAGES, TONE_PRESETS } from './constants/presets';
import { audioEngine } from './audio/audioEngine';
import { nativeEngine } from './engines/nativeEngine';
import { cloudAiEngine } from './engines/cloudAiEngine';
import { webGpuEngine } from './engines/webgpuEngine';

import { AetherFluidOrb } from './components/visualizer/AetherFluidOrb';
import { AudioSpectrumWave } from './components/visualizer/AudioSpectrumWave';
import { ToneSelector } from './components/controls/ToneSelector';
import { EngineSwitcher } from './components/controls/EngineSwitcher';
import { LanguagePicker } from './components/controls/LanguagePicker';
import { RecordButton } from './components/controls/RecordButton';
import { TranslationCard } from './components/output/TranslationCard';
import { SettingsModal } from './components/settings/SettingsModal';
import { Waves, Sparkles, AlertCircle, Send, Play, Wand2, Trash2 } from 'lucide-react';

const SAMPLE_PROMPTS = [
  'Greetings human! I am your overlord.',
  'Where can I find the ultimate pizza?',
  'Initiating cybernetic system diagnostics.',
  'Hello world, this is a test of voice power!',
];

export default function App() {
  // Engine & Preset States
  const [engineMode, setEngineMode] = useState<EngineMode>('native');
  const [selectedToneId, setSelectedToneId] = useState<TonePresetId>('demon');
  const [sourceLang, setSourceLang] = useState<Language>(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState<Language>(LANGUAGES[1]); // Spanish

  // Status & Transcript States
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready • Tap Mic to Speak');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [customInputText, setCustomInputText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistent Text & Audio State (NEVER lost when changing tone!)
  const [persistedSpokenText, setPersistedSpokenText] = useState<string>('');
  const [persistedTranslatedText, setPersistedTranslatedText] = useState<string>('');
  const [processedResult, setProcessedResult] = useState<ProcessedAudio | null>(null);

  const [workerProgress, setWorkerProgress] = useState<WorkerProgress | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cloudConfig, setCloudConfig] = useState(cloudAiEngine.getConfig());

  // Cached AudioBuffer of user's voice for re-morphing through DSP
  const lastRecordedBufferRef = useRef<AudioBuffer | null>(null);
  const stopNativeRecognitionRef = useRef<(() => void) | null>(null);

  const activeTone = TONE_PRESETS.find((p) => p.id === selectedToneId) || TONE_PRESETS[0];

  // Initialize WebGPU worker callback if WebGPU mode is selected
  useEffect(() => {
    if (engineMode === 'webgpu') {
      webGpuEngine.init((prog) => {
        setWorkerProgress(prog);
        if (prog.message) {
          setStatusMessage(prog.message);
        }
      });
    }
  }, [engineMode]);

  // Main Push-to-Talk Recording Trigger
  const handleToggleRecord = async () => {
    setErrorMessage(null);

    // Sync unlock AudioContext immediately on touch (crucial for mobile iOS & Android)
    audioEngine.initContext();

    if (isListening) {
      // USER TAPPED TO STOP RECORDING
      setIsListening(false);
      setStatusMessage('Processing your voice...');

      if (stopNativeRecognitionRef.current) {
        try {
          stopNativeRecognitionRef.current();
        } catch {
          // Ignore
        }
        stopNativeRecognitionRef.current = null;
      }

      try {
        const { buffer, float32 } = await audioEngine.stopRecording();
        lastRecordedBufferRef.current = buffer;

        let transcript = interimTranscript.trim();

        // If WebGPU mode is selected or if native STT was empty, try Whisper
        if (engineMode === 'webgpu' || (!transcript && engineMode === 'cloud')) {
          setStatusMessage('Neural transcribing...');
          try {
            transcript = await webGpuEngine.transcribeAudio(float32);
          } catch {
            // Fall through
          }
        }

        if (transcript) {
          // We have recognized words! Proceed to translation & character speech
          await handleProcessSpokenText(transcript);
        } else {
          // Direct voice changer fallback (when STT is blocked on mobile)
          setStatusMessage(`Morphing your voice into ${activeTone.name}...`);
          const { blob, url, buffer: modulatedBuffer } = await audioEngine.renderModulatedAudio(
            buffer,
            selectedToneId
          );

          const defaultSpoken = persistedSpokenText || 'Your Spoken Voice (Direct Audio Modulation)';
          const defaultTranslated = persistedTranslatedText || `Voice morphed with ${activeTone.name} DSP effects`;

          const result: ProcessedAudio = {
            id: `${Date.now()}`,
            timestamp: Date.now(),
            originalText: defaultSpoken,
            translatedText: defaultTranslated,
            sourceLang,
            targetLang,
            appliedTone: selectedToneId,
            audioBlobUrl: url,
            durationSec: blob.size,
          };

          setProcessedResult(result);
          setIsPlaying(true);
          setStatusMessage(`Playing ${activeTone.name}...`);
          audioEngine.playBuffer(modulatedBuffer, () => {
            setIsPlaying(false);
            setStatusMessage('Ready • Tap Mic to Speak');
          });
        }
      } catch (err) {
        setErrorMessage((err as Error).message || 'Audio capture failed');
        setStatusMessage('Ready • Tap Mic to Speak');
      }
    } else {
      // START RECORDING
      try {
        nativeEngine.stopSpeaking();
        audioEngine.stopPlayback();
        setIsPlaying(false);
        setInterimTranscript('');

        // 1. ALWAYS open microphone with Web Audio so Aether Fluid Orb dances and records
        await audioEngine.startRecording();
        setIsListening(true);
        setStatusMessage('Listening to voice... Speak now!');

        // 2. Start browser Speech Recognition in background for live streaming transcript
        if (engineMode !== 'webgpu') {
          try {
            const stopRec = nativeEngine.startSpeechRecognition(
              sourceLang.ttsLang,
              (text, isFinal) => {
                setInterimTranscript(text);
                if (isFinal && text.trim()) {
                  // Captured final phrase
                }
              },
              (err) => {
                console.warn('Native speech notice:', err);
              }
            );
            stopNativeRecognitionRef.current = stopRec;
          } catch {
            // Speech recognition not available
          }
        }
      } catch (err) {
        setErrorMessage(
          (err as Error).message ||
            'Could not access microphone. Please allow microphone permissions in Chrome/Safari settings.'
        );
        setIsListening(false);
        setStatusMessage('Mic Access Denied');
      }
    }
  };

  // Main Text -> Translation -> Speech Modulation pipeline
  const handleProcessSpokenText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    setInterimTranscript(text);
    setPersistedSpokenText(text);

    try {
      // Step 1: Translate text if needed
      setStatusMessage(`Translating to ${targetLang.name}...`);
      let translated = text;

      if (sourceLang.code !== targetLang.code) {
        if (engineMode === 'cloud') {
          translated = await cloudAiEngine.translateWithStyle(
            text,
            sourceLang,
            targetLang,
            selectedToneId
          );
        } else {
          translated = await nativeEngine.translateText(
            text,
            sourceLang.code,
            targetLang.code
          );
        }
      }

      setPersistedTranslatedText(translated);

      // Step 2: Update UI state (Preserves text!)
      const result: ProcessedAudio = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        originalText: text,
        translatedText: translated,
        sourceLang,
        targetLang,
        appliedTone: selectedToneId,
      };

      setProcessedResult(result);

      // Step 3: Speak real human words with acoustic character tone
      playCharacterVoice(translated, targetLang, selectedToneId);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Processing failed');
      setStatusMessage('Ready • Tap Mic');
    }
  };

  // Speak real words with the character pitch/speed/tone
  const playCharacterVoice = (
    text: string,
    lang: Language,
    toneId: TonePresetId
  ) => {
    nativeEngine.stopSpeaking();
    audioEngine.stopPlayback();

    const tonePreset = TONE_PRESETS.find((p) => p.id === toneId) || activeTone;
    setStatusMessage(`Speaking as ${tonePreset.name}...`);
    setIsPlaying(true);

    // Feed FFT energy into visualizer so orb dances to speech
    audioEngine.startSpeechVisualizer();

    nativeEngine.speakWithTone(
      text,
      lang,
      toneId,
      () => {
        setIsPlaying(true);
      },
      () => {
        setIsPlaying(false);
        audioEngine.stopSpeechVisualizer();
        setStatusMessage('Ready • Tap Mic to Speak');
      }
    );
  };

  // Instant Demo: Preview what any character tone sounds like with 1 tap!
  const handlePlayToneDemo = (toneId: TonePresetId) => {
    setSelectedToneId(toneId);
    const preset = TONE_PRESETS.find((p) => p.id === toneId) || activeTone;
    const demoPhrases: Record<TonePresetId, string> = {
      demon: 'I am the ancient Titan demon! Bow before my underworld roar!',
      chipmunk: 'Hey look at me! I am super fast, high pitched and squeaky!',
      robot: 'System online. Cybernetic dalek protocol fully engaged.',
      walkietalkie: 'Over and out. Radio transmission loud and clear, 10-4.',
      ethereal: 'Floating through the cosmic aether of the astral dimension...',
      alien: 'Greetings Earth creature, we have arrived from galaxy 9.',
      original: 'This is clean natural voice in high definition audio.',
    };

    const phrase = demoPhrases[toneId] || `Testing ${preset.name} voice.`;
    handleProcessSpokenText(phrase);
  };

  // Re-modulate current translated speech or audio buffer with a new tone
  // CRITICAL: NEVER WIPES OUT THE SPOKEN OR TRANSLATED TEXT!
  const handleReModulate = async (toneId: TonePresetId) => {
    setSelectedToneId(toneId);

    // Determine the text to keep
    const textToKeep =
      persistedTranslatedText ||
      processedResult?.translatedText ||
      persistedSpokenText ||
      processedResult?.originalText;

    const originalToKeep =
      persistedSpokenText || processedResult?.originalText || 'Your Spoken Voice';

    // If we have text, update result card and speak with new character tone!
    if (textToKeep && !textToKeep.startsWith('Voice morphed with')) {
      const updated: ProcessedAudio = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        originalText: originalToKeep,
        translatedText: textToKeep,
        sourceLang: processedResult?.sourceLang || sourceLang,
        targetLang: processedResult?.targetLang || targetLang,
        appliedTone: toneId,
      };

      setProcessedResult(updated);
      playCharacterVoice(textToKeep, updated.targetLang, toneId);
    } else if (lastRecordedBufferRef.current) {
      // Re-modulate the raw recorded audio buffer with new DSP chain
      setStatusMessage(`Re-morphing into ${toneId}...`);
      const { blob, url, buffer: modulatedBuffer } = await audioEngine.renderModulatedAudio(
        lastRecordedBufferRef.current,
        toneId
      );

      setProcessedResult({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        originalText: originalToKeep,
        translatedText: `Voice morphed with ${toneId} DSP effects`,
        sourceLang: processedResult?.sourceLang || sourceLang,
        targetLang: processedResult?.targetLang || targetLang,
        appliedTone: toneId,
        audioBlobUrl: url,
        durationSec: blob.size,
      });

      setIsPlaying(true);
      audioEngine.playBuffer(modulatedBuffer, () => {
        setIsPlaying(false);
        setStatusMessage('Ready • Tap Mic to Speak');
      });
    }
  };

  const handlePlayCurrent = () => {
    if (!processedResult) return;
    if (processedResult.audioBlobUrl) {
      setIsPlaying(true);
      audioEngine.playUrl(processedResult.audioBlobUrl, () => {
        setIsPlaying(false);
        setStatusMessage('Ready • Tap Mic to Speak');
      });
    } else {
      playCharacterVoice(
        processedResult.translatedText,
        processedResult.targetLang,
        processedResult.appliedTone
      );
    }
  };

  const handleStopPlayback = () => {
    nativeEngine.stopSpeaking();
    audioEngine.stopPlayback();
    audioEngine.stopSpeechVisualizer();
    setIsPlaying(false);
    setStatusMessage('Ready • Tap Mic to Speak');
  };

  const handleClearSession = () => {
    nativeEngine.stopSpeaking();
    audioEngine.stopPlayback();
    audioEngine.stopSpeechVisualizer();
    setIsPlaying(false);
    setPersistedSpokenText('');
    setPersistedTranslatedText('');
    setInterimTranscript('');
    setProcessedResult(null);
    lastRecordedBufferRef.current = null;
    setStatusMessage('Ready • Tap Mic to Speak');
  };

  const handleSwapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  // Submit manual text / sample prompt
  const handleCustomSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customInputText.trim()) return;
    handleProcessSpokenText(customInputText.trim());
    setCustomInputText('');
  };

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="top-header">
        <div className="brand-badge">
          <div className="brand-icon">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Putta's Voice Game</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                144Hz PWA
              </span>
            </h1>
            <p className="text-[11px] text-white/50 hidden sm:block">
              Neural Voice Modulator & Cross-Language Speech Synthesizer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Session Button if text exists */}
          {(persistedSpokenText || processedResult) && (
            <button
              onClick={handleClearSession}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-red-400 text-xs transition-colors border border-white/10"
              title="Clear text and start new recording"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/70">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  engineMode === 'cloud'
                    ? '#c084fc'
                    : engineMode === 'webgpu'
                    ? '#34d399'
                    : '#22d3ee',
              }}
            />
            <span className="capitalize">{engineMode} Mode</span>
          </div>
        </div>
      </header>

      {/* Error alert toast */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[11px] font-mono underline hover:text-white px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Decks (Tablet Landscape 2-Column Deck / Stacked Mobile) */}
      <main className="studio-decks">
        {/* Left Studio Deck: Visualizer, Mic & Tone Presets */}
        <section className="deck-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-white/50 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aether Fluid Core</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              {isListening ? '● REC ACTIVE' : '144 FPS Engine'}
            </span>
          </div>

          {/* 144Hz Fluid Orb Canvas */}
          <div className="w-full h-60 sm:h-64 md:h-72 rounded-3xl bg-black/40 border border-white/10 relative overflow-hidden flex items-center justify-center shadow-inner">
            <AetherFluidOrb
              analyser={audioEngine.analyser}
              activeTone={activeTone}
              isListening={isListening}
              isPlaying={isPlaying}
              status={statusMessage}
            />
          </div>

          {/* Live Audio Spectrum Bar Equalizer */}
          <div className="w-full bg-black/30 p-2 rounded-2xl border border-white/5">
            <AudioSpectrumWave
              analyser={audioEngine.analyser}
              activeTone={activeTone}
              isActive={isListening || isPlaying}
            />
          </div>

          {/* Big Push-To-Talk Mic Button */}
          <RecordButton
            isListening={isListening}
            activeTone={activeTone}
            onClick={handleToggleRecord}
          />

          {/* Live speech preview while speaking */}
          {interimTranscript && isListening && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-sm font-medium text-center shadow-lg animate-pulse">
              "{interimTranscript}..."
            </div>
          )}

          {/* Quick Instant Demos (Hear tones with 1 tap!) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
              Instant Tone Demos (Tap to Test Voice):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => handlePlayToneDemo('demon')}
                className="py-1.5 px-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>👹 Demon</span>
              </button>
              <button
                onClick={() => handlePlayToneDemo('chipmunk')}
                className="py-1.5 px-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>🐿️ Chipmunk</span>
              </button>
              <button
                onClick={() => handlePlayToneDemo('robot')}
                className="py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>🤖 Robot</span>
              </button>
              <button
                onClick={() => handlePlayToneDemo('walkietalkie')}
                className="py-1.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>📻 Radio</span>
              </button>
            </div>
          </div>

          {/* Quick Manual Text Input */}
          <form onSubmit={handleCustomSubmit} className="flex gap-2 w-full mt-1">
            <input
              type="text"
              value={customInputText}
              onChange={(e) => setCustomInputText(e.target.value)}
              placeholder="Or type any text to speak & translate..."
              className="flex-1 bg-black/40 text-white text-xs font-medium py-2.5 px-3.5 rounded-xl border border-white/10 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3.5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Vocal Character Tone Selector Grid */}
          <ToneSelector
            selectedTone={selectedToneId}
            onSelectTone={(id) => {
              setSelectedToneId(id);
              handleReModulate(id);
            }}
          />
        </section>

        {/* Right Command Deck: Engine, Languages & Translation Output */}
        <section className="deck-panel">
          {/* Engine Switcher */}
          <EngineSwitcher
            mode={engineMode}
            onSelectMode={(mode) => setEngineMode(mode)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            workerProgress={workerProgress}
            hasCloudKey={cloudAiEngine.hasApiKey()}
          />

          {/* Language Translation Picker */}
          <LanguagePicker
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSelectSource={setSourceLang}
            onSelectTarget={setTargetLang}
            onSwap={handleSwapLanguages}
          />

          {/* Quick Fun Test Prompts */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-purple-400" />
              <span>Tap a Sample Sentence to Speak & Translate:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleProcessSpokenText(prompt)}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 text-white/80 hover:text-white px-3 py-1.5 rounded-xl transition-all text-left"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>

          {/* Modulated Translation Output Card */}
          <TranslationCard
            data={processedResult}
            isPlaying={isPlaying}
            onPlay={handlePlayCurrent}
            onStop={handleStopPlayback}
            onReModulate={handleReModulate}
            activeTone={activeTone}
          />

          {/* Tablet & Mobile Tip */}
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-white/40 font-mono gap-1">
            <span>💡 Tap any tone above to hear the same text re-morphed!</span>
            <span className="text-white/60">Text Stays Locked</span>
          </div>
        </section>
      </main>

      {/* Cloud & Hardware Acceleration Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={cloudConfig}
        onSaveConfig={(cfg) => {
          setCloudConfig(cfg);
          cloudAiEngine.saveConfig(cfg);
        }}
      />
    </div>
  );
}
