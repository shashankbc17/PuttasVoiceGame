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
import { Waves, Sparkles, AlertCircle, Send, Wand2 } from 'lucide-react';

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

  // Audio & Data States
  const [processedResult, setProcessedResult] = useState<ProcessedAudio | null>(null);
  const [workerProgress, setWorkerProgress] = useState<WorkerProgress | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cloudConfig, setCloudConfig] = useState(cloudAiEngine.getConfig());

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

    if (isListening) {
      // User tapped to finish recording
      setIsListening(false);
      setStatusMessage('Processing your speech...');

      if (stopNativeRecognitionRef.current) {
        stopNativeRecognitionRef.current();
        stopNativeRecognitionRef.current = null;
      }

      if (engineMode === 'webgpu') {
        try {
          const { float32 } = await audioEngine.stopRecording();
          setStatusMessage('Whisper Neural Transcribing...');
          const transcript = await webGpuEngine.transcribeAudio(float32);
          if (transcript.trim()) {
            await handleProcessSpokenText(transcript.trim());
          } else {
            setStatusMessage('No speech heard • Try speaking louder');
          }
        } catch (err) {
          setErrorMessage((err as Error).message || 'Audio capture failed');
          setStatusMessage('Ready • Tap Mic');
        }
      } else {
        // Native mode finish
        if (interimTranscript.trim()) {
          await handleProcessSpokenText(interimTranscript.trim());
        } else {
          setStatusMessage('No speech detected • Speak clearly');
        }
      }
    } else {
      // START RECORDING
      try {
        nativeEngine.stopSpeaking();
        audioEngine.stopPlayback();
        setIsPlaying(false);
        setInterimTranscript('');

        if (engineMode === 'webgpu') {
          // WebGPU requires raw PCM audio bytes for Whisper
          await audioEngine.startRecording();
          setIsListening(true);
          setStatusMessage('Listening (Whisper WebGPU)...');
        } else {
          // Native / Cloud mode: Use Android Chrome SpeechRecognizer cleanly without locking mic
          setIsListening(true);
          setStatusMessage('Listening... Speak now!');

          const stopRec = nativeEngine.startSpeechRecognition(
            sourceLang.ttsLang,
            (text, isFinal) => {
              setInterimTranscript(text);
              if (isFinal && text.trim()) {
                setIsListening(false);
                if (stopNativeRecognitionRef.current) {
                  stopNativeRecognitionRef.current();
                  stopNativeRecognitionRef.current = null;
                }
                handleProcessSpokenText(text.trim());
              }
            },
            (err) => {
              setErrorMessage(err);
              setIsListening(false);
              setStatusMessage('Speech error • Try again');
            }
          );
          stopNativeRecognitionRef.current = stopRec;
        }
      } catch (err) {
        setErrorMessage(
          (err as Error).message ||
            'Could not access microphone. Please allow microphone permissions in Chrome settings.'
        );
        setIsListening(false);
        setStatusMessage('Mic Access Denied');
      }
    }
  };

  // Main Text -> Translation -> Speech Modulation pipeline
  const handleProcessSpokenText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) {
      setStatusMessage('No words heard • Try speaking closer');
      return;
    }

    setInterimTranscript(text);

    try {
      // Step 1: Translate text
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

      // Step 2: Update UI state with recognized & translated words
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

      // Step 3: Speak real human words with acoustic character tone!
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
        setStatusMessage('Ready • Tap Mic');
      }
    );
  };

  // Re-modulate current translated speech with a different character tone
  const handleReModulate = (toneId: TonePresetId) => {
    setSelectedToneId(toneId);
    if (!processedResult) return;

    const updated = {
      ...processedResult,
      appliedTone: toneId,
    };
    setProcessedResult(updated);

    playCharacterVoice(
      processedResult.translatedText,
      processedResult.targetLang,
      toneId
    );
  };

  const handlePlayCurrent = () => {
    if (!processedResult) return;
    playCharacterVoice(
      processedResult.translatedText,
      processedResult.targetLang,
      processedResult.appliedTone
    );
  };

  const handleStopPlayback = () => {
    nativeEngine.stopSpeaking();
    audioEngine.stopPlayback();
    audioEngine.stopSpeechVisualizer();
    setIsPlaying(false);
    setStatusMessage('Ready • Tap Mic');
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

      {/* Main Studio Decks (Tablet Landscape 2-Column Deck) */}
      <main className="studio-decks">
        {/* Left Studio Deck: Visualizer, Mic & Tone Presets */}
        <section className="deck-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-white/50 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aether Fluid Core</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              144 FPS Engine
            </span>
          </div>

          {/* 144Hz Fluid Orb Canvas */}
          <div className="w-full h-64 md:h-72 rounded-3xl bg-black/40 border border-white/10 relative overflow-hidden flex items-center justify-center shadow-inner">
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

          {/* Quick Manual Text Input (Type or speak anytime!) */}
          <form onSubmit={handleCustomSubmit} className="flex gap-2 w-full">
            <input
              type="text"
              value={customInputText}
              onChange={(e) => setCustomInputText(e.target.value)}
              placeholder="Or type anything to speak & translate..."
              className="flex-1 bg-black/40 text-white text-xs font-medium py-2.5 px-3.5 rounded-xl border border-white/10 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Vocal Character Tone Selector Grid */}
          <ToneSelector
            selectedTone={selectedToneId}
            onSelectTone={(id) => {
              setSelectedToneId(id);
              if (processedResult && !isListening) {
                handleReModulate(id);
              }
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
              <span>Tap a Sample to Hear Instant Voice:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleProcessSpokenText(prompt)}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 text-white/80 hover:text-white px-3 py-1.5 rounded-xl transition-all"
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

          {/* Tablet Ergonomics Tip */}
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
            <span>💡 Select same language to hear your words in funny character tones!</span>
            <span className="text-white/60">Snapdragon 870 Ready</span>
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
