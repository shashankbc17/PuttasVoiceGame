import React from 'react';
import type { EngineMode, WorkerProgress } from '../../types';
import { Zap, Cpu, ShieldCheck, Settings2 } from 'lucide-react';

interface EngineSwitcherProps {
  mode: EngineMode;
  onSelectMode: (mode: EngineMode) => void;
  onOpenSettings: () => void;
  workerProgress?: WorkerProgress | null;
  hasCloudKey: boolean;
}

export const EngineSwitcher: React.FC<EngineSwitcherProps> = ({
  mode,
  onSelectMode,
  onOpenSettings,
  workerProgress,
  hasCloudKey,
}) => {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs uppercase tracking-wider font-semibold text-white/50">
          Inference Engine
        </span>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Config</span>
        </button>
      </div>

      {/* Segmented Control */}
      <div className="grid grid-cols-3 p-1.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 gap-1.5">
        {/* Mode 1: Native Tablet / OS */}
        <button
          onClick={() => onSelectMode('native')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 ${
            mode === 'native'
              ? 'bg-gradient-to-b from-cyan-500/20 to-blue-500/20 border border-cyan-400/40 text-cyan-300 shadow-md shadow-cyan-950/40'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Zap className={`w-3.5 h-3.5 ${mode === 'native' ? 'text-cyan-400' : 'text-white/40'}`} />
            <span className="font-semibold text-xs tracking-tight">Native OS</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">0 MB • Instant</span>
        </button>

        {/* Mode 2: Cloud AI */}
        <button
          onClick={() => onSelectMode('cloud')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 ${
            mode === 'cloud'
              ? 'bg-gradient-to-b from-purple-500/20 to-pink-500/20 border border-purple-400/40 text-purple-300 shadow-md shadow-purple-950/40'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Cpu className={`w-3.5 h-3.5 ${mode === 'cloud' ? 'text-purple-400' : 'text-white/40'}`} />
            <span className="font-semibold text-xs tracking-tight">Cloud AI</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">
            {hasCloudKey ? 'Gemini 3.6' : 'Key Required'}
          </span>
        </button>

        {/* Mode 3: On-Device WebGPU */}
        <button
          onClick={() => onSelectMode('webgpu')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 ${
            mode === 'webgpu'
              ? 'bg-gradient-to-b from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 text-emerald-300 shadow-md shadow-emerald-950/40'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldCheck className={`w-3.5 h-3.5 ${mode === 'webgpu' ? 'text-emerald-400' : 'text-white/40'}`} />
            <span className="font-semibold text-xs tracking-tight">On-Device</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">WebGPU / WASM</span>
        </button>
      </div>

      {/* Progress banner for WebGPU model download */}
      {mode === 'webgpu' && workerProgress && workerProgress.status === 'downloading' && (
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span>Downloading Whisper Neural Model...</span>
            <span className="font-bold">{workerProgress.progress || 0}%</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${workerProgress.progress || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
