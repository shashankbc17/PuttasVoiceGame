import React from 'react';
import type { TonePreset, TonePresetId } from '../../types';
import { TONE_PRESETS } from '../../constants/presets';
import { Mic, Flame, Bot, Sparkles, Radio, Ghost, Zap } from 'lucide-react';

interface ToneSelectorProps {
  selectedTone: TonePresetId;
  onSelectTone: (toneId: TonePresetId) => void;
}

const ICONS: Record<string, React.FC<{ className?: string }>> = {
  Mic,
  Flame,
  Bot,
  Sparkles,
  Radio,
  Ghost,
  Zap,
};

export const ToneSelector: React.FC<ToneSelectorProps> = ({
  selectedTone,
  onSelectTone,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <span className="text-xs uppercase tracking-wider font-semibold text-white/50">
          Vocal Character & DSP Tone
        </span>
        <span className="text-[11px] text-white/40 font-mono">
          {TONE_PRESETS.length} Real-Time Racks
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {TONE_PRESETS.map((preset: TonePreset) => {
          const isSelected = selectedTone === preset.id;
          const Icon = ICONS[preset.iconName] || Mic;

          return (
            <button
              key={preset.id}
              onClick={() => onSelectTone(preset.id)}
              className={`relative group flex flex-col p-3 rounded-2xl text-left transition-all duration-300 border overflow-hidden ${
                isSelected
                  ? 'bg-white/[0.08] shadow-lg border-white/30 scale-[1.02]'
                  : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 hover:border-white/15'
              }`}
              style={{
                boxShadow: isSelected ? `0 8px 24px -6px ${preset.glowColor}` : 'none',
              }}
            >
              {/* Dynamic glowing gradient border accent */}
              {isSelected && (
                <div
                  className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-2xl"
                  style={{
                    background: `linear-gradient(90deg, ${preset.primaryColor}, ${preset.secondaryColor})`,
                  }}
                />
              )}

              <div className="flex items-center justify-between w-full mb-1.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: isSelected ? preset.glowColor : 'rgba(255, 255, 255, 0.05)',
                    color: isSelected ? '#ffffff' : preset.primaryColor,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isSelected ? `${preset.primaryColor}25` : 'rgba(255, 255, 255, 0.05)',
                    color: isSelected ? preset.primaryColor : 'rgba(255, 255, 255, 0.4)',
                  }}
                >
                  {preset.tag}
                </span>
              </div>

              <span className="font-semibold text-sm text-white tracking-tight">
                {preset.name}
              </span>
              <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5 leading-snug">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
