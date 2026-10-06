import React from 'react';

/** Decorative boarding-pass barcode. Deterministic bars derived from `value`. */
export default function Barcode({ value, className = '' }: { value: string; className?: string }) {
  const bars: number[] = [];
  let seed = Array.from(value || 'SKYGUARDIAN').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0;
  for (let i = 0; i < 42; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    bars.push(1 + (seed % 3));
  }
  let x = 0;
  return (
    <svg viewBox="0 0 168 40" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={40} fill="currentColor" /> : null;
        x += w + 1;
        return rect;
      })}
    </svg>
  );
}
