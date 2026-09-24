import React from 'react';
import type { Language } from '../../types';
import { LANGUAGES } from '../../constants/presets';
import { ArrowLeftRight } from 'lucide-react';

interface LanguagePickerProps {
  sourceLang: Language;
  targetLang: Language;
  onSelectSource: (lang: Language) => void;
  onSelectTarget: (lang: Language) => void;
  onSwap: () => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  sourceLang,
  targetLang,
  onSelectSource,
  onSelectTarget,
  onSwap,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs uppercase tracking-wider font-semibold text-white/50">
          Language Translation
        </span>
        <span className="text-[11px] text-white/40 font-mono">
          {sourceLang.name} → {targetLang.name}
        </span>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        {/* Source Language Selector */}
        <div className="flex-1 relative">
          <label className="text-[10px] text-white/40 font-mono block px-1 mb-0.5">FROM</label>
          <select
            value={sourceLang.code}
            onChange={(e) => {
              const found = LANGUAGES.find((l) => l.code === e.target.value);
              if (found) onSelectSource(found);
            }}
            className="w-full bg-black/40 text-white font-medium text-sm py-2 px-3 rounded-xl border border-white/10 focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                {l.flag} {l.name} ({l.nativeName})
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <button
          onClick={onSwap}
          title="Swap Languages"
          className="mt-4 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-all duration-200 border border-white/10 hover:rotate-180"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* Target Language Selector */}
        <div className="flex-1 relative">
          <label className="text-[10px] text-white/40 font-mono block px-1 mb-0.5">TO</label>
          <select
            value={targetLang.code}
            onChange={(e) => {
              const found = LANGUAGES.find((l) => l.code === e.target.value);
              if (found) onSelectTarget(found);
            }}
            className="w-full bg-black/40 text-white font-medium text-sm py-2 px-3 rounded-xl border border-white/10 focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                {l.flag} {l.name} ({l.nativeName})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
