'use client';

import { useEffect, useState } from 'react';

type Props = {
  heights: number[];
  labels?: string[];
  className?: string;
};

export function AnimatedBars({ heights, labels, className }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`flex h-[120px] items-end gap-1.5 ${className || ''}`}>
      {heights.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full max-w-[22px] rounded-t bg-teal-600/90 transition-[height] duration-700 ease-out"
            style={{
              height: ready ? h : 0,
              transitionDelay: `${i * 40}ms`,
            }}
          />
          {labels?.[i] && (
            <span className="text-[9px] text-slate-400">{labels[i]}</span>
          )}
        </div>
      ))}
    </div>
  );
}
