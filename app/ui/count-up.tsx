"use client";

import { useEffect, useState } from "react";

// counts once from 0 to value on mount. reduced motion or no JS → the final number is simply there (SSR renders it).
export function CountUp({ value, prefix = "", suffix = "", decimals = 2, className = "" }: { value: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}
