import React from 'react';
import type { TonePreset } from '../../types';
import { Mic, Square } from 'lucide-react';

interface RecordButtonProps {
  isListening: boolean;
  activeTone: TonePreset;
  onClick: () => void;
  disabled?: boolean;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  isListening,
  activeTone,
  onClick,
  disabled = false,
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center my-2">
      {/* Animated concentric pulse rings when active */}
      {isListening && (
        <>
          <div
            className="absolute w-24 h-24 rounded-full animate-ping opacity-30 pointer-events-none"
            style={{ backgroundColor: activeTone.primaryColor }}
          />
          <div
            className="absolute w-32 h-32 rounded-full animate-pulse opacity-20 pointer-events-none"
            style={{ backgroundColor: activeTone.secondaryColor }}
          />
        </>
      )}

      {/* Main Touch Button */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none ${
          isListening
            ? 'scale-105'
            : 'hover:scale-105'
        }`}
        style={{
          background: isListening
            ? `radial-gradient(circle, ${activeTone.primaryColor}, #000000)`
            : `linear-gradient(135deg, ${activeTone.primaryColor}, ${activeTone.secondaryColor})`,
          boxShadow: `0 12px 35px -8px ${activeTone.glowColor}`,
        }}
      >
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/20">
          {isListening ? (
            <Square className="w-7 h-7 text-white fill-white animate-pulse" />
          ) : (
            <Mic className="w-8 h-8 text-white drop-shadow-md" />
          )}
        </div>
      </button>

      {/* Status Label */}
      <div className="mt-3 text-center">
        <span className="text-xs font-mono font-medium tracking-wider uppercase text-white/70 block">
          {isListening ? 'Listening • Tap to Finish' : 'Tap to Speak & Modulate'}
        </span>
      </div>
    </div>
  );
};
