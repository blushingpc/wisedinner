"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DeviceFrame } from "./device-frame";
import { ReceiptReveal, ThisWeek } from "@/app/screens";
import { fixtureWeek, usd } from "@/data/fixtures";

// HERO PHONE STAGE (REDESIGN-V3 §4): S1 front-left at −6°, S4 back-right at +4° and 88%, overlapping; two callout
// bubbles off S1; a hand-drawn arrow from S1's scorecard to S4's comparison that draws on first view (900ms, static
// under reduced motion); the tenders basket and smash burger cut-outs breaking the phone edges; 3px pointer parallax
// on desktop only (§7). Every number is the fixture's.
export function PhoneStage() {
  const root = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // reduced motion: the CSS already renders the arrow fully drawn and disables the parallax transition
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setDrawn(true), { threshold: 0.4 });
    io.observe(el);
    const fine = window.matchMedia("(pointer: fine) and (min-width: 1024px)").matches;
    const onMove = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setDx(((ev.clientX - r.left) / r.width - 0.5) * 6);
      setDy(((ev.clientY - r.top) / r.height - 0.5) * 6);
    };
    const onLeave = () => {
      setDx(0);
      setDy(0);
    };
    if (fine) {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    }
    return () => {
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const tue = fixtureWeek.days.find((d) => d.day === "tue")!;
  const dinner = tue.meals.find((m) => m.slot === "dinner")!;
  const short = dinner.name.replace(/^crispy baked /, "").replace(/ with .*$/, "");

  return (
    <div ref={root} className="hero-field relative mx-auto aspect-[10/16] w-full max-w-[600px] select-none lg:aspect-[600/780]">
      {/* S4 — back-right, +4°, 88% */}
      <div className="absolute right-[1%] top-0 w-[53%] transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translate(${-dx * 0.5}px, ${-dy * 0.5}px)` }}>
        <DeviceFrame label="phone showing the receipt reveal: estimated $49.20, actual $48.61, receipt verified" tilt="right" widthClass="w-full" className="rotate-[4deg]" chrome={false} sizes="(min-width: 1024px) 318px, 182px">
          <ReceiptReveal week={fixtureWeek} />
        </DeviceFrame>
      </div>
      {/* S1 — front-left, −6° */}
      <div className="absolute left-[4%] top-[5%] w-[60%] transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
        <DeviceFrame label={`phone showing this week: ${tue.meals.map((m) => m.name).join(", ")}; under budget by ${usd(fixtureWeek.totals.under_budget_by_usd)}`} tilt="left" priority widthClass="w-full" className="rotate-[-6deg]" chrome={false} sizes="(min-width: 1024px) 360px, 206px">
          <ThisWeek week={fixtureWeek} active="tue" priority />
        </DeviceFrame>
      </div>

      {/* callouts off S1 */}
      <Callout className="right-[2%] top-[58%] rotate-[-2deg] lg:right-auto lg:left-[40%]">
        {short} · {dinner.protein_g}g · {usd(dinner.cost_usd)}
      </Callout>
      <Callout className="left-[-1%] top-[67%] rotate-[2deg]" tone="kale">
        under budget by {usd(fixtureWeek.totals.under_budget_by_usd)}
      </Callout>

      {/* hand-drawn arrow: S1 scorecard → S4 comparison */}
      <svg aria-hidden="true" viewBox="0 0 600 780" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full text-kale ${drawn ? "arrow-drawn" : ""}`} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round">
        <path className="arrow-path" d="M 310 452 C 400 446, 470 420, 470 350 C 470 300, 450 272, 432 250" />
        <path className="arrow-head" d="M 416 270 L 432 250 L 448 272" />
      </svg>

      {/* cut-outs breaking the phone edges (§2I): tenders basket bottom-left, smash burger right */}
      <Image
        src="/img/cutout-tenders-basket.png"
        alt=""
        width={1524}
        height={1077}
        quality={75}
        priority
        sizes="(min-width: 1024px) 300px, 190px"
        className="dish-drift img-grade absolute bottom-[4%] left-[-4%] z-(--z-decoration) w-[44%] [filter:drop-shadow(0_24px_28px_rgba(27,26,24,0.28))]"
      />
      <Image
        src="/img/cutout-smash-burger.png"
        alt=""
        width={1600}
        height={1139}
        quality={75}
        sizes="(min-width: 1024px) 220px, 130px"
        style={{ animationDelay: "-3s" }}
        className="dish-drift img-grade absolute bottom-[22%] right-[-4%] z-(--z-decoration) w-[32%] [filter:drop-shadow(0_24px_28px_rgba(27,26,24,0.28))]"
      />
    </div>
  );
}

function Callout({ children, className = "", tone = "paper" }: { children: React.ReactNode; className?: string; tone?: "paper" | "kale" }) {
  return (
    <p className={`callout absolute z-(--z-raised) whitespace-nowrap rounded-[10px] px-3 py-1.5 font-mono text-[0.75rem] font-semibold shadow-tag lg:text-[0.875rem] ${tone === "kale" ? "bg-kale text-bg" : "bg-white text-ink"} ${className}`}>{children}</p>
  );
}
