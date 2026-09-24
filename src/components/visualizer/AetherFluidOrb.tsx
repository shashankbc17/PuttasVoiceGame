import React, { useEffect, useRef } from 'react';
import type { TonePreset } from '../../types';

interface AetherFluidOrbProps {
  analyser: AnalyserNode | null;
  activeTone: TonePreset;
  isListening: boolean;
  isPlaying: boolean;
  status: string;
}

export const AetherFluidOrb: React.FC<AetherFluidOrbProps> = ({
  analyser,
  activeTone,
  isListening,
  isPlaying,
  status,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    // Handle High-DPI display scaling smoothly without layout thrashing
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Audio FFT frequency data array
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    // Animation state variables
    let phase = 0;
    let smoothedVolume = 0;
    let lastTime = performance.now();

    // Particle stardust orbiters
    const numParticles = 48;
    const particles = Array.from({ length: numParticles }, (_, i) => ({
      angle: (i / numParticles) * Math.PI * 2,
      distance: 85 + Math.random() * 45,
      speed: 0.008 + Math.random() * 0.012,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.3 + Math.random() * 0.7,
    }));

    const render = (time: number) => {
      if (width === 0 || height === 0) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const centerX = width / 2;
      const centerY = height / 2;

      // Extract real audio amplitude & frequencies
      let currentVolume = 0;
      if (analyser && (isListening || isPlaying)) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 40; i++) {
          sum += dataArray[i];
        }
        currentVolume = sum / (40 * 255); // 0 to 1
      } else if (isListening) {
        // Natural pulsing visualizer while speech recognizer is active
        currentVolume = 0.28 + Math.sin(time / 160) * 0.12;
      }

      // Smooth volume transitions with responsive spring
      smoothedVolume += (currentVolume - smoothedVolume) * 0.15;
      const activeFactor = isListening || isPlaying ? 1 : 0.25;
      const effectiveVol = Math.max(smoothedVolume, 0.05 * activeFactor);

      // Increment phase adapted to 144Hz display
      const speedMultiplier = 1 + effectiveVol * 3.5;
      phase += dt * 1.8 * speedMultiplier;

      // Clear frame with soft fade trail
      ctx.clearRect(0, 0, width, height);

      // Base radius scaled to container
      const baseRadius = Math.min(width, height) * 0.26 * (1 + effectiveVol * 0.4);

      // 1. Draw outer ambient atmospheric glow (hardware accelerated gradients)
      const outerGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        baseRadius * 2.2
      );
      outerGlow.addColorStop(0, activeTone.glowColor);
      outerGlow.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
      outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw orbiting stardust particles
      particles.forEach((p) => {
        p.angle += p.speed * (1 + effectiveVol * 3);
        const pDist = p.distance * (baseRadius / 80);
        const px = centerX + Math.cos(p.angle) * pDist;
        const py = centerY + Math.sin(p.angle) * (pDist * 0.85);

        ctx.fillStyle = activeTone.primaryColor;
        ctx.globalAlpha = p.alpha * (0.4 + effectiveVol * 0.6);
        ctx.beginPath();
        ctx.arc(px, py, p.size * (1 + effectiveVol * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // 3. Draw multi-layered organic fluid ripples
      const layers = 3;
      for (let l = 0; l < layers; l++) {
        const layerRadius = baseRadius * (1 - l * 0.1);
        const layerPhase = phase * (1 + l * 0.3) + l * 1.5;
        const waveCount = 5 + l;

        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.05) {
          // Harmonic wave distortion
          const harmonic1 = Math.sin(a * waveCount + layerPhase);
          const harmonic2 = Math.cos(a * (waveCount - 1) - layerPhase * 0.7);
          const freqIndex = Math.floor(((a / (Math.PI * 2)) * 32) % bufferLength);
          const audioKick = (dataArray[freqIndex] / 255) * 18 * effectiveVol;

          const r = layerRadius + (harmonic1 * 10 + harmonic2 * 6) * effectiveVol + audioKick;
          const x = centerX + Math.cos(a) * r;
          const y = centerY + Math.sin(a) * r;

          if (a === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        // Layer gradient fill
        const gradient = ctx.createLinearGradient(
          centerX - layerRadius,
          centerY - layerRadius,
          centerX + layerRadius,
          centerY + layerRadius
        );

        if (l === 0) {
          gradient.addColorStop(0, activeTone.primaryColor);
          gradient.addColorStop(1, activeTone.secondaryColor);
          ctx.fillStyle = gradient;
          ctx.globalAlpha = 0.88;
          ctx.fill();
        } else if (l === 1) {
          gradient.addColorStop(0, activeTone.secondaryColor);
          gradient.addColorStop(1, '#ffffff');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = 0.35 + effectiveVol * 0.25;
          ctx.fill();
        } else {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5 + effectiveVol * 0.4;
          ctx.stroke();
        }
      }

      // Reset context alpha & shadow
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // 4. Central Core Specular Highlight
      const coreGradient = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        baseRadius * 0.05,
        centerX,
        centerY,
        baseRadius * 0.8
      );
      coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      coreGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.15)');
      coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [analyser, activeTone, isListening, isPlaying]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full max-h-[360px] md:max-h-[440px] pointer-events-none"
      />
      <div className="absolute bottom-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-mono tracking-wider uppercase text-white/80">
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: activeTone.primaryColor }}
        />
        <span>{status}</span>
      </div>
    </div>
  );
};
