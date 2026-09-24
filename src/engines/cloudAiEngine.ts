import type { CloudConfig, Language, TonePresetId } from '../types';

export class CloudAiEngine {
  private config: CloudConfig = {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.0-flash',
  };

  constructor() {
    this.loadConfig();
  }

  public getConfig(): CloudConfig {
    return this.config;
  }

  public saveConfig(config: CloudConfig): void {
    this.config = config;
    localStorage.setItem('linguamorph_cloud_config', JSON.stringify(config));
  }

  private loadConfig(): void {
    const saved = localStorage.getItem('linguamorph_cloud_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch {
        // Ignore
      }
    }
  }

  public hasApiKey(): boolean {
    return !!this.config.apiKey?.trim();
  }

  // Translate text using Gemini 2.0 with stylistic tone awareness
  public async translateWithStyle(
    text: string,
    sourceLang: Language,
    targetLang: Language,
    tone: TonePresetId
  ): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('Please enter your Google Gemini or OpenAI API Key in settings to use Cloud AI.');
    }

    if (this.config.provider === 'gemini') {
      return this.translateWithGemini(text, sourceLang, targetLang, tone);
    } else {
      return this.translateWithOpenAI(text, sourceLang, targetLang, tone);
    }
  }

  private async translateWithGemini(
    text: string,
    sourceLang: Language,
    targetLang: Language,
    tone: TonePresetId
  ): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-2.0-flash'}:generateContent?key=${this.config.apiKey.trim()}`;

    const prompt = `You are a high-fidelity speech translator engine for a voice modulation app.
Translate the following spoken sentence from ${sourceLang.name} into ${targetLang.name}.
Target vocal character tone: "${tone}". Keep the translation natural and faithful to spoken conversational cadence.
Do NOT include any explanations, quotes, or notes. Return ONLY the translated sentence text.

Sentence to translate: "${text}"`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!result) {
      throw new Error('Gemini did not return a translation.');
    }
    return result.replace(/^["']|["']$/g, '');
  }

  private async translateWithOpenAI(
    text: string,
    sourceLang: Language,
    targetLang: Language,
    tone: TonePresetId
  ): Promise<string> {
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a speech translator for a voice modulator app with tone "${tone}". Translate from ${sourceLang.name} to ${targetLang.name}. Return ONLY the direct translation, nothing else.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }
}

export const cloudAiEngine = new CloudAiEngine();
