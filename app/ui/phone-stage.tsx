"use client";

import Image from "next/image";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";
import { DeviceFrame } from "./device-frame";
import type { ReactNode } from "react";

// HERO PHONE STAGE (REDESIGN-V4 §6): S1 This week front-left at −6°, S4 Receipt reveal back-right at +4° and 88%,
// two white callout cards with a small emerald check, a hand-drawn arrow from S1's checks to S4's comparison that
// draws on first view, and the two cut-outs per §5D: lit from the top left like the phone glare, overlapping the
// bezel edge by 12 to 20% of their width, resting on a CSS contact shadow, never wider than 60% of a phone, tucked
// behind the phone on mobile. Every number is the fixture's. The two screens arrive as server-rendered nodes so the
// client bundle carries only this stage.
export function PhoneStage({ s1, s4, s1Label, s4Label, calloutMeal, calloutBudget }: { s1: ReactNode; s4: ReactNode; s1Label: string; s4Label: string; calloutMeal: string; calloutBudget: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  // the back phone's screen mounts after hydration: shaping the screens' text is half of the hero's first layout on a
  // throttled phone (measured), and S4 sits behind S1 and mostly below the fold on mobile. its bezel paints at once.
  const [late, setLate] = useState(false);

  useEffect(() => {
    setLate(true);
    const el = root.current;
    if (!el) return;
    // reduced motion: the CSS already renders the arrow fully drawn
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setDrawn(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className="relative isolate mx-auto aspect-[10/16] w-full max-w-[560px] select-none lg:aspect-[600/760]">
      {/* S4: back-right, +4°, 88% */}
      <div className="absolute top-0 right-[1%] w-[53%]">
        <DeviceFrame label={s4Label} tilt="right" widthClass="w-full" className="rotate-[4deg]" chrome={false} ptClass="pt-hero-s4" sizes="(min-width: 1024px) 256px, (min-width: 608px) 297px, calc((100vw - 48px) * 0.53)">
          {late ? s4 : null}
        </DeviceFrame>
      </div>
      {/* S1: front-left, −6° */}
      <div className="absolute top-[5%] left-[4%] w-[60%]">
        <DeviceFrame label={s1Label} tilt="left" priority widthClass="w-full" className="rotate-[-6deg]" chrome={false} ptClass="pt-hero-s1" sizes="(min-width: 1024px) 290px, (min-width: 608px) 336px, calc((100vw - 48px) * 0.6)">
          {s1}
        </DeviceFrame>
      </div>

      {/* callouts off S1 */}
      {/* right-anchored until xl: from lg the stage column is ~400px and a left-anchored callout ran past the section edge (audit A-03) */}
      <Callout className="top-[58%] right-[2%] rotate-[-2deg] xl:right-auto xl:left-[36%]">{calloutMeal}</Callout>
      <Callout className="top-[66%] left-[-1%] rotate-[2deg]">{calloutBudget}</Callout>

      {/* hand-drawn arrow: S1's checks → S4's comparison */}
      <svg aria-hidden="true" viewBox="0 0 600 780" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 z-(--z-raised) h-full w-full text-forest ${drawn ? "arrow-drawn" : ""}`} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round">
        <path className="arrow-path" d="M 310 452 C 400 446, 470 420, 470 350 C 470 300, 450 272, 432 250" />
        <path className="arrow-head" d="M 416 270 L 432 250 L 448 272" />
      </svg>

      {/* cut-outs (§5D): the burrito bowl over S1's bottom-left edge, the parfait over S4's right edge.
          mobile: smaller and behind the phones (negative z inside the isolated stage) */}
      <div className="contact-shadow absolute bottom-[3%] left-[-3%] -z-10 w-[26%] lg:z-(--z-decoration) lg:w-[34%]">
        <Image src="/img/cutout-burrito-bowl.png" alt="" width={900} height={756} quality={90} sizes="(min-width: 1024px) 164px, 89px" className="h-auto w-full" />
      </div>
      <div className="contact-shadow absolute right-[-5%] bottom-[46%] -z-10 w-[20%] lg:z-(--z-decoration) lg:w-[26%]">
        <Image src="/img/cutout-parfait.png" alt="" width={900} height={742} quality={90} sizes="(min-width: 1024px) 126px, 68px" className="h-auto w-full" />
      </div>
    </div>
  );
}

function Callout({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`absolute z-(--z-raised) inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium whitespace-nowrap shadow-card tnum lg:text-[0.875rem] ${className}`}>
      <Check size="1em" weight="bold" aria-hidden="true" className="shrink-0 text-emerald" />
      {children}
    </p>
  );
}
