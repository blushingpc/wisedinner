"use client";

import { useEffect, useRef, useState } from "react";
import { STEPS } from "../copy";
import { DeviceFrame } from "./device-frame";

// how-it-works per DESIGN-AUDIT §9.4/§12: desktop pins one phone while three steps scroll past
// (screen crossfades per step); mobile is a snap-scroll carousel with dots. step 2 plays the
// solving chip animation once on enter (§12.2). no JS → step text fully readable, screens static.

const Check = () => (
  <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-yolk text-[10px] font-bold text-ink">
    ✓
  </span>
);

function SliderRow({ label, value, frac }: { label: string; value: string; frac: string }) {
  return (
    <div>
      <p className="text-caption font-semibold text-kale">{label}</p>
      <p className="mt-2 font-mono text-4xl tabular-nums">{value}</p>
      <div aria-hidden="true" className="mt-3 h-1.5 rounded-full bg-rule">
        <div className={`relative h-full rounded-full bg-ink ${frac}`}>
          <span className="absolute -right-2 -top-[5px] block size-4 rounded-full bg-yolk shadow-tag" />
        </div>
      </div>
    </div>
  );
}

function StepScreen({ step, fresh, shelf, play = false }: { step: number; fresh: string[]; shelf: string[]; play?: boolean }) {
  if (step === 0) {
    return (
      <div className="grid gap-8 pt-2">
        <SliderRow label="weekly budget" value="$60" frac="w-1/2" />
        <SliderRow label="protein per day" value="150 g" frac="w-2/3" />
        <p className="text-caption font-semibold text-ink-soft">that&apos;s all we ask.</p>
      </div>
    );
  }
  if (step === 1) {
    // §12.2: chips pop in staggered (~1.5s total), the solved line lands last; plays once, static without JS
    return (
      <div className={`pt-2 ${play ? "solve-play" : ""}`}>
        <p className="text-caption font-semibold text-kale">solving your week</p>
        <ul className="mt-3 flex flex-wrap gap-1">
          {[...fresh, ...shelf].map((n, i) => (
            <li
              key={n}
              style={{ "--chip-delay": `${i * 90}ms` } as React.CSSProperties}
              className="chip-in rounded-full border border-rule px-2 py-0.5 text-xs leading-snug"
            >
              {n}
            </li>
          ))}
        </ul>
        <p className="solve-done mt-5 flex items-center gap-2 text-caption font-semibold text-kale">
          <Check /> solved — five days, one list
        </p>
      </div>
    );
  }
  const row = (n: string) => (
    <li key={n} className="flex items-center gap-2 text-[0.9375rem]">
      <Check /> {n}
    </li>
  );
  return (
    <div className="pt-2">
      <p className="text-caption font-semibold text-kale">fresh aisle</p>
      <ul className="mt-2 grid gap-1.5">{fresh.slice(0, 4).map(row)}</ul>
      <p className="mt-4 text-caption font-semibold text-kale">shelf + freezer</p>
      <ul className="mt-2 grid gap-1.5">
        {shelf.slice(0, 4).map(row)}
        <li className="text-ink-soft">…</li>
      </ul>
      <p className="mt-5 text-caption font-semibold text-kale">fridge</p>
      <p className="text-2xl font-bold">empty, on purpose.</p>
    </div>
  );
}

export function PinnedWalkthrough({ fresh, shelf }: { fresh: string[]; shelf: string[] }) {
  const [active, setActive] = useState(0);
  const [slide, setSlide] = useState(0);
  const [played, setPlayed] = useState(false);
  const stepsRef = useRef<HTMLOListElement>(null);

  // the solving animation fires the first time step 2 enters (either layout), then stays settled
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- latches the one-shot solve animation when step 2 first enters
    if (active === 1 || slide === 1) setPlayed(true);
  }, [active, slide]);

  useEffect(() => {
    const els = stepsRef.current?.querySelectorAll<HTMLElement>("[data-step]");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="how" className="bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <h2 className="text-h2 font-bold">how it works</h2>

        {/* desktop: pinned phone, steps scroll — total stays ≤1500px (gate 18.5) */}
        <div className="mt-4 hidden lg:grid lg:grid-cols-[7fr_5fr] lg:gap-12">
          <ol ref={stepsRef}>
            {STEPS.map(([title, body], i) => (
              <li key={title} data-step={i} className="flex min-h-[400px] max-w-[52ch] flex-col justify-center">
                <h3 className="text-[1.75rem] font-bold">{title}</h3>
                <p className="mt-3 text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
          <div>
            <div className="sticky top-24">
              <DeviceFrame label={`phone showing step ${active + 1}: ${STEPS[active][0]}`} widthClass="w-[380px]" className="mx-auto">
                <div className="relative h-full">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      aria-hidden={i !== active}
                      className={`absolute inset-0 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${
                        i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
                      }`}
                    >
                      <StepScreen step={i} fresh={fresh} shelf={shelf} play={played} />
                    </div>
                  ))}
                </div>
              </DeviceFrame>
            </div>
          </div>
        </div>

        {/* mobile: swipe carousel with dots (gate 18.5) */}
        <div className="lg:hidden">
          <ol
            tabIndex={0}
            aria-label="the three steps, swipe or scroll sideways"
            onScroll={(e) => {
              const el = e.currentTarget;
              const range = el.scrollWidth - el.clientWidth;
              if (range > 0) setSlide(Math.round((el.scrollLeft / range) * (STEPS.length - 1)));
            }}
            className="-mx-6 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {STEPS.map(([title, body], i) => (
              <li key={title} className="w-[88%] shrink-0 snap-center">
                <h3 className="text-2xl font-bold">{title}</h3>
                <p className="mt-2 text-ink-soft">{body}</p>
                <DeviceFrame label={`phone showing step ${i + 1}: ${title}`} widthClass="w-[240px]" className="mx-auto mt-6">
                  <StepScreen step={i} fresh={fresh} shelf={shelf} play={played} />
                </DeviceFrame>
              </li>
            ))}
          </ol>
          <div aria-hidden="true" className="mt-4 flex justify-center gap-2">
            {STEPS.map((_, i) => (
              <span key={i} className={`size-2 rounded-full transition-colors ${i === slide ? "bg-ink" : "bg-rule"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
