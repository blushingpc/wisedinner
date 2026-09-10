"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { DeviceFrame } from "./device-frame";
import { SectionHeading } from "./section";

// SECTION 2 (REDESIGN-V4 §6): centered H2, DeviceFrame left, four cards right (the active card is white with a forest
// 2px border). Click or tap = 250ms crossfade; auto-advance every 5s until the first interaction; dots. Mobile: the
// cards collapse to a chip row above the phone. Tabs pattern: arrow keys move, Home/End jump. Two round arrow buttons
// flank the phone (FRONTEND-V4.1 §3), on the same state as the cards and dots; left/right keys work from the phone
// side too; any interaction stops the auto-advance.
// The four screens arrive server-rendered as `screens` so none of app/screens hydrates.

// 44px round, white, hairline, forest icon (§3 shape: no shadow off a card)
const ARROW = "grid size-11 shrink-0 place-items-center rounded-full border border-border bg-white text-forest transition-[background-color,border-color] duration-200 ease-press hover:border-ink-2 hover:bg-surface active:scale-[0.96]";

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
  const step = (d: 1 | -1) => pick((active + d + items.length) % items.length);
  // left/right from the arrows or the phone itself
  const onStageKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    step(e.key === "ArrowRight" ? 1 : -1);
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
    <section id="how" className="cv-auto bg-white py-band">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <SectionHeading>{h2}</SectionHeading>
        <div className="mt-10 grid items-center gap-8 lg:mt-14 lg:grid-cols-[5fr_6fr] lg:gap-16">
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
                  className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-left text-[0.9375rem] font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-200 ease-press lg:rounded-card lg:px-6 lg:py-5 lg:whitespace-normal ${on ? "bg-white text-ink shadow-[inset_0_0_0_2px_var(--color-forest)]" : "bg-surface text-ink-2 hover:text-ink lg:bg-white lg:shadow-[inset_0_0_0_1px_var(--color-border)] lg:hover:shadow-[inset_0_0_0_1px_var(--color-ink-2)]"}`}
                >
                  <span className="block lg:font-display lg:text-[1.125rem] lg:font-bold lg:tracking-[-0.01em] lg:text-ink">{it.title}</span>
                  <span className={`mt-2 hidden text-[0.9375rem] leading-relaxed font-normal text-ink-2 lg:block ${on ? "" : "lg:hidden"}`}>{it.body}</span>
                </button>
              );
            })}
          </div>

          {/* the phone: only the active screen is mounted (four full screens in the DOM cost ~600ms of layout and
              hydration on a throttled phone); the incoming screen fades in over 250ms */}
          <div className="order-2 lg:order-1">
            {/* the arrows sit in the page gutter on phones (-mx-4) so the 260px frame keeps its size at 390 */}
            <div className="-mx-4 flex items-center justify-center gap-2 sm:mx-0 sm:gap-5" onKeyDown={onStageKey}>
              <button type="button" onClick={() => step(-1)} aria-label="Previous screen" className={ARROW}>
                <CaretLeft size={20} weight="bold" aria-hidden="true" />
              </button>
              <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="w-[260px] max-w-[calc(100vw-140px)] lg:w-[340px]">
                <DeviceFrame label={`Phone showing ${items[active].title}`} widthClass="w-full" chrome={false} ptClass="pt-switcher" sizes="(min-width: 1024px) 340px, 260px">
                  <div key={active} className="fade-in absolute inset-0">
                    {screens[active]}
                  </div>
                </DeviceFrame>
              </div>
              <button type="button" onClick={() => step(1)} aria-label="Next screen" className={ARROW}>
                <CaretRight size={20} weight="bold" aria-hidden="true" />
              </button>
            </div>
            {/* the body under the phone on mobile, where the cards are chips */}
            <p className="mx-auto mt-5 max-w-[44ch] text-center text-[0.9375rem] leading-relaxed text-ink-2 lg:hidden">{items[active].body}</p>
            <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
              {items.map((it, i) => (
                <span key={it.title} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === active ? "w-6 bg-forest" : "w-1.5 bg-border"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
