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
import { Waves, Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  // Engine & Preset States
  const [engineMode, setEngineMode] = useState<EngineMode>('native');
  const [selectedToneId, setSelectedToneId] = useState<TonePresetId>('demon');
  const [sourceLang, setSourceLang] = useState<Language>(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState<Language>(LANGUAGES[1]); // Spanish

  // Status & Transcript States
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready • Tap Mic');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio & Data States
  const [processedResult, setProcessedResult] = useState<ProcessedAudio | null>(null);
  const [workerProgress, setWorkerProgress] = useState<WorkerProgress | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cloudConfig, setCloudConfig] = useState(cloudAiEngine.getConfig());

  // Cached raw audio buffer for re-modulation
  const currentSynthesizedBuffer = useRef<AudioBuffer | null>(null);
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

  // Main Recording Trigger
  const handleToggleRecord = async () => {
    setErrorMessage(null);

    if (isListening) {
      // STOP RECORDING
      setIsListening(false);
      setStatusMessage('Processing audio...');

      if (stopNativeRecognitionRef.current) {
        stopNativeRecognitionRef.current();
        stopNativeRecognitionRef.current = null;
      }

      try {
        const { buffer, float32 } = await audioEngine.stopRecording();
        await processCapturedAudio(buffer, float32);
      } catch (err) {
        setErrorMessage((err as Error).message || 'Failed to capture audio');
        setStatusMessage('Ready • Tap Mic');
      }
    } else {
      // START RECORDING
      try {
        audioEngine.stopPlayback();
        setIsPlaying(false);

        await audioEngine.startRecording();
        setIsListening(true);
        setInterimTranscript('');
        setStatusMessage('Listening to voice...');

        // If in Native mode, use real-time streaming speech recognition
        if (engineMode === 'native') {
          const stopRec = nativeEngine.startSpeechRecognition(
            sourceLang.ttsLang,
            (text) => {
              setInterimTranscript(text);
            },
            (err) => {
              console.warn('Native speech warning:', err);
            }
          );
          stopNativeRecognitionRef.current = stopRec;
        }
      } catch (err) {
        setErrorMessage(
          (err as Error).message ||
            'Could not access microphone. Please grant mic permissions in your tablet settings.'
        );
        setIsListening(false);
        setStatusMessage('Mic Access Error');
      }
    }
  };

  // Process voice -> transcribe -> translate -> modulate
  const processCapturedAudio = async (
    originalBuffer: AudioBuffer,
    float32: Float32Array
  ) => {
    let transcript = interimTranscript.trim();

    try {
      // Step 1: Speech-to-Text Transcription
      if (engineMode === 'webgpu' || !transcript) {
        setStatusMessage('Neural transcribing...');
        if (engineMode === 'webgpu') {
          transcript = await webGpuEngine.transcribeAudio(float32);
        }
      }

      if (!transcript) {
        setStatusMessage('No speech detected • Try speaking closer');
        return;
      }

      setInterimTranscript(transcript);

      // Step 2: Language Translation
      setStatusMessage(`Translating to ${targetLang.name}...`);
      let translatedText = transcript;

      if (sourceLang.code !== targetLang.code) {
        if (engineMode === 'cloud') {
          translatedText = await cloudAiEngine.translateWithStyle(
            transcript,
            sourceLang,
            targetLang,
            selectedToneId
          );
        } else {
          translatedText = await nativeEngine.translateText(
            transcript,
            sourceLang.code,
            targetLang.code
          );
        }
      }

      // Step 3: Speech Synthesis
      setStatusMessage('Synthesizing vocal cadence...');
      const ctx = audioEngine.getContext();
      let synthBuffer: AudioBuffer;

      if (sourceLang.code === targetLang.code) {
        // Direct modulation of user's own original vocal recording!
        synthBuffer = originalBuffer;
      } else {
        synthBuffer = await nativeEngine.synthesizeToAudioBuffer(translatedText, targetLang, ctx);
      }
      currentSynthesizedBuffer.current = synthBuffer;

      // Step 4: Web Audio DSP Tone Modulation
      setStatusMessage(`Applying ${activeTone.name} DSP rack...`);
      const { blob, url, buffer: modulatedBuffer } = await audioEngine.renderModulatedAudio(
        synthBuffer,
        selectedToneId
      );

      // Step 5: Save Result
      const result: ProcessedAudio = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        originalText: transcript,
        translatedText,
        sourceLang,
        targetLang,
        appliedTone: selectedToneId,
        audioBlobUrl: url,
        durationSec: blob.size,
      };

      setProcessedResult(result);
      setStatusMessage('Playing modulated voice...');

      // Step 6: Automatically play the modulated voice
      setIsPlaying(true);
      audioEngine.playBuffer(modulatedBuffer, () => {
        setIsPlaying(false);
        setStatusMessage('Ready • Tap Mic');
      });
    } catch (err) {
      setErrorMessage((err as Error).message || 'Audio processing error');
      setStatusMessage('Error occurred');
    }
  };

  // Re-modulate current audio with a new tone preset
  const handleReModulate = async (toneId: TonePresetId) => {
    setSelectedToneId(toneId);
    if (!currentSynthesizedBuffer.current || !processedResult) return;

    try {
      setStatusMessage(`Re-morphing into ${toneId}...`);
      const { url, buffer: modulatedBuffer } = await audioEngine.renderModulatedAudio(
        currentSynthesizedBuffer.current,
        toneId
      );

      setProcessedResult({
        ...processedResult,
        appliedTone: toneId,
        audioBlobUrl: url,
      });

      setIsPlaying(true);
      audioEngine.playBuffer(modulatedBuffer, () => {
        setIsPlaying(false);
        setStatusMessage('Ready • Tap Mic');
      });
    } catch (err) {
      setErrorMessage((err as Error).message || 'Re-modulation failed');
    }
  };

  // Play existing modulated audio
  const handlePlayCurrent = () => {
    if (!processedResult?.audioBlobUrl) return;
    setIsPlaying(true);
    setStatusMessage(`Playing ${activeTone.name}...`);
    audioEngine.playUrl(processedResult.audioBlobUrl, () => {
      setIsPlaying(false);
      setStatusMessage('Ready • Tap Mic');
    });
  };

  const handleStopPlayback = () => {
    audioEngine.stopPlayback();
    setIsPlaying(false);
    setStatusMessage('Ready • Tap Mic');
  };

  const handleSwapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
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
            <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 text-xs font-mono italic text-center">
              "{interimTranscript}..."
            </div>
          )}

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
            <span>💡 Tip: Select same language to use purely as a voice changer!</span>
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
