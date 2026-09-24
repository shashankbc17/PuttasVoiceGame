import React, { useEffect, useRef } from 'react';
import type { TonePreset } from '../../types';

interface AudioSpectrumWaveProps {
  analyser: AnalyserNode | null;
  activeTone: TonePreset;
  isActive: boolean;
}

export const AudioSpectrumWave: React.FC<AudioSpectrumWaveProps> = ({
  analyser,
  activeTone,
  isActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const barCount = 36;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
    const smoothedHeights = new Float32Array(barCount).fill(4);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
      }

      const barWidth = Math.max(2.5, (width - (barCount - 1) * 3) / barCount);
      const totalWidth = barCount * barWidth + (barCount - 1) * 3;
      const startX = (width - totalWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        let targetHeight = 4;
        if (analyser && isActive) {
          // Sample low to mid-high frequencies logarithmically
          const freqIndex = Math.min(Math.floor(Math.pow(i / barCount, 1.4) * 50), dataArray.length - 1);
          const raw = dataArray[freqIndex] / 255;
          targetHeight = 4 + raw * (height - 8);
        } else {
          // Subtle idle ambient breathing wave
          const t = performance.now() / 800;
          targetHeight = 4 + Math.sin(t + i * 0.25) * 3;
        }

        // Smooth spring physics for 144Hz
        smoothedHeights[i] += (targetHeight - smoothedHeights[i]) * 0.22;

        const x = startX + i * (barWidth + 3);
        const barH = Math.max(3, smoothedHeights[i]);
        const y = height / 2 - barH / 2;

        // Gradient for each bar
        const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
        gradient.addColorStop(0, activeTone.primaryColor);
        gradient.addColorStop(1, activeTone.secondaryColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Pill shaped bars
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, barH, radius);
        ctx.fill();

        // Neon Glow on taller peaks
        if (barH > height * 0.45) {
          ctx.shadowColor = activeTone.primaryColor;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [analyser, activeTone, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-12 rounded-xl pointer-events-none opacity-90"
    />
  );
};
