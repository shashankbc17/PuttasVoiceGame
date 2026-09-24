import React, { useState } from 'react';
import type { CloudConfig } from '../../types';
import { X, Key, Cpu, Sparkles, Check, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CloudConfig;
  onSaveConfig: (config: CloudConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [provider, setProvider] = useState<'gemini' | 'openai'>(config.provider || 'gemini');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [model, setModel] = useState(config.model || 'gemini-3.6-flash');
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      provider,
      apiKey: apiKey.trim(),
      model,
    });
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 1000);
  };

  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0e111a] border border-white/15 p-6 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Engine Configuration</h3>
              <p className="text-xs text-white/50">Google Gemini & tablet acceleration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hardware Status Banner */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white">Device Hardware Acceleration</span>
            <span className="text-[11px] text-white/50">
              Snapdragon 870 • Adreno 650 GPU (Vulkan)
            </span>
          </div>
          <span
            className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
              hasWebGPU
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {hasWebGPU ? 'WebGPU Active' : 'WASM Fallback'}
          </span>
        </div>

        {/* Provider Switcher */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono text-white/60 uppercase tracking-wider">
            Cloud Provider (For Mode 2)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setProvider('gemini');
                setModel('gemini-3.6-flash');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                provider === 'gemini'
                  ? 'bg-purple-500/20 border-purple-400 text-white shadow-lg shadow-purple-950/40'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm block">Google Gemini</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200">PRO</span>
              </div>
              <span className="text-[11px] text-white/40">Gemini 3.6 Flash (Fastest)</span>
            </button>

            <button
              onClick={() => {
                setProvider('openai');
                setModel('gpt-4o-mini');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                provider === 'openai'
                  ? 'bg-purple-500/20 border-purple-400 text-white shadow-lg shadow-purple-950/40'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <span className="font-semibold text-sm block">OpenAI</span>
              <span className="text-[11px] text-white/40">GPT-4o Mini / Whisper</span>
            </button>
          </div>
        </div>

        {/* API Key Input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>{provider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key</span>
            </label>
            <div className="flex items-center gap-2">
              {apiKey.trim() && (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5" /> Ready
                </span>
              )}
              <a
                href={
                  provider === 'gemini'
                    ? 'https://aistudio.google.com/app/apikey'
                    : 'https://platform.openai.com/api-keys'
                }
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <span>Get Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              provider === 'gemini' ? 'AQ.Ab8... or AIzaSy...' : 'sk-proj-...'
            }
            className="w-full bg-black/50 text-white text-sm font-mono p-3.5 rounded-xl border border-white/15 focus:border-purple-400 focus:outline-none"
          />
          <span className="text-[11px] text-white/40">
            Stored locally in your device’s secure localStorage. Powering instant character translations.
          </span>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-semibold text-sm text-white shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2 active:scale-98 transition-all"
        >
          {savedToast ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Configuration Saved!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Save & Apply Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
