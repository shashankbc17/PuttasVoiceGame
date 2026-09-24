# LinguaMorph ⚡

**Neural Voice Modulator & Cross-Language Speech Synthesizer (PWA)**  
Tailored for **144Hz high-refresh displays** and mobile/tablet hardware like the **Snapdragon 870** (Xiaomi Pad 6).

---

## 🌟 Key Features

1. **Dual / 3-Tier Inference Engine:**
   - **🚀 Native OS Mode:** Instant, 0 MB download, hardware-accelerated Google Speech Services on Android Chrome with live streaming transcription and zero battery drain.
   - **⚡ Cloud AI Mode:** Powered by Google Gemini 2.0 Flash or OpenAI GPT-4o-mini with stylistic tone steering.
   - **🔒 On-Device WebGPU Mode:** Transformers.js v4 running `whisper-tiny` on local GPU shaders via Vulkan/WebGPU in a dedicated Web Worker (with WASM fallback).

2. **Web Audio DSP Modulation Rack (7 Character Tones):**
   - **Natural Studio:** Crisp mastering EQ & warm limiter.
   - **Titan Demon:** Pitch shift (-7 semitones) + sub-bass boost (80Hz) + cavernous dark reverb.
   - **Cyber Dalek:** 65Hz Ring Modulator + WaveShaper distortion + resonant formant peak.
   - **Pixie Chipmunk:** Pitch shift (+8 semitones) + high-frequency shimmer.
   - **Walkie-Talkie:** 400Hz–3.2kHz telecom bandpass + overdrive + simulated radio static.
   - **Astral Spirit:** 450ms stereo ping-pong delay + cathedral shimmer convolver.
   - **Cosmic Alien:** FM vibrato warp + space oscillation.

3. **144 FPS Aether Fluid Orb:**
   - Real-time 2D Canvas visualizer with delta-time physics tuned for 144Hz displays.
   - Scaled for 2.8K Retina DPI screens (`devicePixelRatio`).
   - Dynamically shifts color palette and fluid tendrils to match the selected vocal character.

4. **Tablet Workstation Ergonomics:**
   - Split-deck landscape layout: Left deck for live audio capture & visualizer, Right deck for translation, engine switching, and WAV audio export.
   - Full PWA installability with standalone fullscreen mode.

---

## 🚀 Running on Your Android Tablet

Your Vite development server is running with network host enabled:
- **Local:** `http://localhost:5173/`
- **Tablet on Wi-Fi:** `http://192.168.1.20:5173/`

### To install on your 11" Android Tablet:
1. Open Chrome on your tablet and navigate to `http://192.168.1.20:5173/`.
2. Tap the Chrome three-dot menu `⋮` and select **"Add to Home screen"** or **"Install app"**.
3. Launch **LinguaMorph** in full-screen standalone mode with 144Hz fluidity!
