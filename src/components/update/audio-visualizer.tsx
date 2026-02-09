"use client";

import { useRef, useEffect, useState } from "react";

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  compact?: boolean;
}

export function AudioVisualizer({ analyserNode, compact = false }: AudioVisualizerProps) {
  const barCount = compact ? 16 : 26;
  const maxHeight = compact ? 32 : 64;
  const containerHeight = compact ? "h-8" : "h-16";

  const [bars, setBars] = useState<number[]>(() => new Array(barCount).fill(4));
  const animFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!analyserNode) return;

    const bufferLength = analyserNode.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;

    const update = () => {
      if (!dataArrayRef.current) return;
      analyserNode.getByteFrequencyData(dataArrayRef.current);

      const newBars: number[] = [];
      const step = bufferLength / barCount;
      for (let i = 0; i < barCount; i++) {
        const index = Math.floor(i * step);
        const value = dataArrayRef.current[index] || 0;
        const height = 4 + (value / 255) * (maxHeight - 4);
        newBars.push(height);
      }
      setBars(newBars);
      animFrameRef.current = requestAnimationFrame(update);
    };

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyserNode, barCount, maxHeight]);

  return (
    <div className={`flex items-center justify-center gap-[3px] ${containerHeight}`}>
      {bars.map((height, i) => {
        const normalizedHeight = height / maxHeight;
        return (
          <div
            key={i}
            className="w-[6px] rounded-full"
            style={{
              height: `${height}px`,
              backgroundColor: `rgba(239, 68, 68, ${0.4 + normalizedHeight * 0.6})`,
              transition: "height 75ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}
