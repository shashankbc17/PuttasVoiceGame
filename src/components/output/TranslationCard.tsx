import React from 'react';
import type { ProcessedAudio, TonePreset, TonePresetId } from '../../types';
import { TONE_PRESETS } from '../../constants/presets';
import { Play, Square, Download, Volume2, Sparkles, Copy, Check } from 'lucide-react';

interface TranslationCardProps {
  data: ProcessedAudio | null;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onReModulate: (toneId: TonePresetId) => void;
  activeTone: TonePreset;
}

export const TranslationCard: React.FC<TranslationCardProps> = ({
  data,
  isPlaying,
  onPlay,
  onStop,
  onReModulate,
  activeTone,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!data) {
    return (
      <div className="w-full h-full min-h-[220px] rounded-3xl bg-white/[0.02] border border-dashed border-white/10 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 mb-3">
          <Volume2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-white/60">No Voice Recorded Yet</h4>
        <p className="text-xs text-white/40 max-w-xs mt-1">
          Tap the glowing microphone on the left deck to speak in any language.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(data.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPreset = TONE_PRESETS.find((p) => p.id === data.appliedTone) || activeTone;

  return (
    <div className="w-full rounded-3xl bg-white/[0.03] border border-white/10 p-5 md:p-6 backdrop-blur-2xl flex flex-col gap-4 shadow-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {data.sourceLang.flag} {data.sourceLang.name}
          </span>
          <span className="text-xs text-white/40">→</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {data.targetLang.flag} {data.targetLang.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold"
            style={{
              backgroundColor: `${currentPreset.primaryColor}20`,
              color: currentPreset.primaryColor,
              border: `1px solid ${currentPreset.primaryColor}40`,
            }}
          >
            <Sparkles className="w-3 h-3" />
            {currentPreset.name}
          </span>
        </div>
      </div>

      {/* Spoken Original */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
          Recognized Voice ({data.sourceLang.name})
        </span>
        <p className="text-sm text-white/70 italic bg-black/20 p-3 rounded-xl border border-white/5">
          "{data.originalText}"
        </p>
      </div>

      {/* Translated Result */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider">
            Translated Speech ({data.targetLang.name})
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <p className="text-base md:text-lg font-medium text-white bg-black/40 p-4 rounded-2xl border border-purple-500/20 leading-relaxed">
          {data.translatedText}
        </p>
      </div>

      {/* Live Playback & Re-Modulate Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        {/* Play/Stop Button */}
        <button
          onClick={isPlaying ? onStop : onPlay}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-semibold text-sm transition-all duration-300 shadow-lg active:scale-95 text-white"
          style={{
            background: isPlaying
              ? '#ef4444'
              : `linear-gradient(135deg, ${currentPreset.primaryColor}, ${currentPreset.secondaryColor})`,
            boxShadow: `0 8px 24px -4px ${currentPreset.glowColor}`,
          }}
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4 fill-white" />
              <span>Stop Modulated Playback</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Play Modulated Voice</span>
            </>
          )}
        </button>

        {/* Quick Tone Switcher (Re-modulate without speaking again!) */}
        <div className="w-full sm:w-auto flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/10">
          <span className="text-[10px] text-white/40 font-mono px-2">TONE</span>
          <select
            value={data.appliedTone}
            onChange={(e) => onReModulate(e.target.value as TonePresetId)}
            className="bg-transparent text-white text-xs font-semibold py-1.5 px-2 focus:outline-none cursor-pointer"
          >
            {TONE_PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Download WAV */}
        {data.audioBlobUrl && (
          <a
            href={data.audioBlobUrl}
            download={`linguamorph-${data.appliedTone}-${Date.now()}.wav`}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border border-white/10 flex items-center justify-center"
            title="Download Modulated Audio (WAV)"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};
