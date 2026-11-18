'use client';

import { useId } from 'react';
import { useAnimatedValue } from '@/hooks/use-animated-value';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({ score, size = 168, strokeWidth = 12 }: ScoreRingProps) {
  const animated = useAnimatedValue(score);
  const gradientId = `score-ring-${useId().replace(/:/g, '')}`;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);

  return (
    <div
      role="img"
      aria-label={`Score ${Math.round(score)} out of 100`}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2D6BFF" />
            <stop offset="100%" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E3E9F5"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl leading-none tracking-tight text-foreground">
          {Math.round(score)}
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}
