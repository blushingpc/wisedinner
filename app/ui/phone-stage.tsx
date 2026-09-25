"use client";

import { useEffect, useRef, useState } from "react";
import { DeviceFrame } from "./device-frame";
import type { ReactNode } from "react";

// HERO PHONE STAGE (SITE-V5 §2, Cal AI structure): two phones and one hand-drawn arrow, the same at every width.
// Left: S7 two numbers ($60, 150g, the solve button), lower left, 58% of the stage, −7°, behind. Right: S1 this week
// (the total pill, five days), upper right, 62% of the stage, +5°, in front, the priority frame. The arrow runs from
// the left phone's solve button to the right phone's total; its two ends are measured off the rendered screens
// ([data-solve], [data-total]) so it lands on them at any width. Nothing else sits in the stage: no cut-outs, no
// callouts, no numbers outside the phones. The box has a fixed aspect, so nothing shifts when the bezels decode.
//
// geometry (stage units, width 100, height 153): right phone left 29.6, top 3 (its rotated top-left corner rises
// 2.5); left phone left 4, top 30, so its solve button clears the right phone's rotated bottom edge. The rotated
// corners reach 7 units past an upright phone's left edge and 5.4 past its right edge: the left phone's top corner
// sits 3 units into the page gutter and the right phone leaves ~6 units for the arrow's run up the right margin.
export const STAGE_SIZES = {
  // stage = the phone column capped at 480px (from 528px viewport up the cap holds until lg); from lg the column is
  // (min(100vw, 1200px) − 136px) / 2.2, capped at 480 again from 1192px
  right: "(min-width: 1192px) 298px, (min-width: 1024px) calc((100vw - 136px) * 0.2818), (min-width: 528px) 298px, calc((100vw - 48px) * 0.62)",
  left: "(min-width: 1192px) 278px, (min-width: 1024px) calc((100vw - 136px) * 0.2636), (min-width: 528px) 278px, calc((100vw - 48px) * 0.58)",
};

type Arrow = { d: string; head: string; w: number; h: number };

export function PhoneStage({ left, right, leftLabel, rightLabel }: { left: ReactNode; right: ReactNode; leftLabel: string; rightLabel: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [arrow, setArrow] = useState<Arrow | null>(null);
  // the left phone mounts one frame after the load event (SITE-V5 §5 perf fallback: shrink it, then lazy-load it).
  // the first paint carries the copy and the right phone only, so the right bezel is the LCP element with no second
  // screen's style and layout in front of it; the left phone fades in after (no fade under reduced motion)
  const [late, setLate] = useState(false);

  useEffect(() => {
    let raf = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      raf = requestAnimationFrame(() => {
        t = setTimeout(() => setLate(true), 0);
      });
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || !late) return;
    const measure = () => {
      const s = el.getBoundingClientRect();
      const solve = el.querySelector("[data-phone=left] [data-solve] > *")?.getBoundingClientRect();
      const total = el.querySelector("[data-phone=right] [data-total]")?.getBoundingClientRect();
      if (!solve || !total || !s.width) return;
      // start: just past the solve button's right end (the part below the right phone's bottom edge); end: the
      // total pill's right end, reached from the right. between them one C-shaped curve runs up the free margin right
      // of the right phone, so the stroke never crosses a screen, only the bezel at the very end
      const x0 = solve.right - s.left + 6;
      const y0 = solve.top - s.top + solve.height * 0.5;
      const x1 = total.right - s.left + 4;
      const y1 = total.top - s.top + total.height * 0.75;
      const c1 = [s.width * 1.02, y0 + s.height * 0.02];
      const c2 = [s.width * 1.04, y1 + s.height * 0.08];
      const d = `M ${x0.toFixed(1)} ${y0.toFixed(1)} C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      // open arrowhead along the end tangent (c2 to the end)
      const a = Math.atan2(y1 - c2[1], x1 - c2[0]);
      const L = Math.max(10, s.width * 0.035);
      const p = (t: number) => `${(x1 - L * Math.cos(a + t)).toFixed(1)} ${(y1 - L * Math.sin(a + t)).toFixed(1)}`;
      setArrow({ d, head: `M ${p(0.5)} L ${x1.toFixed(1)} ${y1.toFixed(1)} L ${p(-0.5)}`, w: s.width, h: s.height });
    };
    measure();
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [late]);

  return (
    <div ref={root} className="relative isolate mx-auto aspect-[100/153] w-full max-w-[480px] select-none">
      <div data-phone="left" className="absolute top-[19.6%] left-[4%] w-[58%]">
        {late && (
          <DeviceFrame label={leftLabel} widthClass="w-full" className="fade-in rotate-[-7deg]" chrome={false} sizes={STAGE_SIZES.left}>
            {left}
          </DeviceFrame>
        )}
      </div>
      <div data-phone="right" className="absolute top-[2%] left-[29.6%] z-10 w-[62%]">
        <DeviceFrame label={rightLabel} priority widthClass="w-full" className="rotate-[5deg]" chrome={false} sizes={STAGE_SIZES.right}>
          {right}
        </DeviceFrame>
      </div>
      {arrow && (
        <svg aria-hidden="true" viewBox={`0 0 ${arrow.w} ${arrow.h}`} className="fade-in pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible text-forest" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d={arrow.d} />
          <path d={arrow.head} />
        </svg>
      )}
    </div>
  );
}
