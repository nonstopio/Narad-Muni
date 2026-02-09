"use client";

import { useRef, useEffect, useState } from "react";

const BAR_COUNT = 26;

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
}

export function AudioVisualizer({ analyserNode }: AudioVisualizerProps) {
  const [bars, setBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(4));
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
      const step = bufferLength / BAR_COUNT;
      for (let i = 0; i < BAR_COUNT; i++) {
        const index = Math.floor(i * step);
        const value = dataArrayRef.current[index] || 0;
        // Map 0-255 to 4-64px height
        const height = 4 + (value / 255) * 60;
        newBars.push(height);
      }
      setBars(newBars);
      animFrameRef.current = requestAnimationFrame(update);
    };

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyserNode]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {bars.map((height, i) => {
        const normalizedHeight = height / 64;
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
