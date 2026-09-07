"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DeviceFrame } from "./device-frame";

// SECTION 2 — "what does wisedinner include?" (REDESIGN-V3 §4): DeviceFrame left, four cards right (active = ink
// outline on paper-alt). Click/tap = 250ms crossfade; auto-advance every 5s until the first interaction; dots.
// Mobile: the cards collapse to a chip row above the phone. Tabs pattern: arrow keys move, Home/End jump.
// The four screens arrive server-rendered as `screens` so none of app/screens hydrates (Lighthouse TBT).

export function FeatureSwitcher({ h2, items, screens }: { h2: string; items: { title: string; body: string }[]; screens: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (touched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [touched, items.length]);

  const pick = (i: number) => {
    setTouched(true);
    setActive(i);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = items.length;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    pick(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="how" className="py-band">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <h2 className="text-h2 font-bold text-balance">{h2}</h2>
        <div className="mt-8 grid items-center gap-8 lg:mt-12 lg:grid-cols-[5fr_6fr] lg:gap-16">
          {/* tabs: chips on mobile (above the phone), cards on desktop (right of it) */}
          <div role="tablist" aria-label={h2} className="order-1 -mx-6 flex gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] lg:order-2 lg:mx-0 lg:grid lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {items.map((it, i) => {
              const on = i === active;
              return (
                <button
                  key={it.title}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`${id}-tab-${i}`}
                  aria-selected={on}
                  aria-controls={`${id}-panel`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => pick(i)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={`lift shrink-0 rounded-full px-4 py-2 text-left text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,box-shadow] duration-200 lg:rounded-[14px] lg:px-6 lg:py-5 lg:whitespace-normal ${on ? "bg-bg-alt text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]" : "bg-bg-alt/60 text-ink-soft hover:bg-bg-alt"}`}
                >
                  <span className="block lg:text-[1.125rem] lg:font-bold lg:text-ink">{it.title}</span>
                  <span className={`mt-2 hidden text-[0.9375rem] leading-snug font-normal text-ink-soft lg:block ${on ? "" : "lg:hidden"}`}>{it.body}</span>
                </button>
              );
            })}
          </div>

          {/* the phone: all four screens stacked, the active one fades in over 250ms */}
          <div className="order-2 lg:order-1">
            <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="mx-auto w-[260px] lg:w-[340px]">
              <DeviceFrame label={`phone showing ${items[active].title}`} widthClass="w-full" chrome={false} sizes="(min-width: 1024px) 340px, 260px">
                {screens.map((s, i) => (
                  <div key={i} aria-hidden={i !== active} className={`absolute inset-0 transition-opacity duration-[250ms] motion-reduce:transition-none ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                    {s}
                  </div>
                ))}
              </DeviceFrame>
            </div>
            {/* the body under the phone on mobile, where the cards are chips */}
            <p className="mx-auto mt-5 max-w-[44ch] text-center text-[0.9375rem] leading-snug text-ink-soft lg:hidden">{items[active].body}</p>
            <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
              {items.map((it, i) => (
                <span key={it.title} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === active ? "w-6 bg-ink" : "w-1.5 bg-rule"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
