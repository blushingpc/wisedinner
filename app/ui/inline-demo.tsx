"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { site } from "@/content/site";
import { PreviewLine } from "./preview-line";

// mirrors floors() in app/api/solve/solver.ts (client bundle stays free of solver+staples)
const itemsFor = (budget: number) => Math.round(8 + 4 * Math.min(1, Math.max(0, (budget - 30) / 25)));

export type DemoDinner = { name: string; img: string; alt: string; price_usd: number };

// ponytail: static band picks from content/site.ts; swap pickDinners for real solver output later
const pickDinners = (budget: number, pool: DemoDinner[]) => {
  const band = site.demo.bands.find((b) => budget <= b.max) ?? site.demo.bands[site.demo.bands.length - 1];
  const idx = site.demo.bands.indexOf(band);
  const dinners = band.dinners.map((n) => pool.find((d) => d.name === n)).filter(Boolean) as DemoDinner[];
  return { idx, dinners };
};

// §9.5 inline demo — value before the ask: sliders, preview line, three real dinner cards by budget band
export function InlineDemo({ pool }: { pool: DemoDinner[] }) {
  const [budget, setBudget] = useState(60);
  const [protein, setProtein] = useState(150);
  const { idx: bandIdx, dinners } = pickDinners(budget, pool);

  return (
    <div className="rounded-[16px] bg-bg p-6 shadow-receipt sm:p-8">
      <label htmlFor="demo-budget" className="block text-caption font-semibold text-kale">
        weekly budget
      </label>
      <div className="mt-2 flex items-center gap-4">
        <input
          id="demo-budget"
          type="range"
          min={30}
          max={120}
          step={5}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="h-11 w-full accent-(--color-kale)"
        />
        <span className="w-14 shrink-0 text-right text-2xl font-semibold tabular-nums">${budget}</span>
      </div>

      <p id="demo-protein-label" className="mt-6 text-caption font-semibold text-kale">
        protein per day
      </p>
      <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="demo-protein-label">
        <button
          type="button"
          onClick={() => setProtein((p) => Math.max(80, p - 10))}
          disabled={protein <= 80}
          aria-label="less protein"
          className="flex size-11 items-center justify-center rounded-[12px] border border-rule text-2xl disabled:opacity-40"
        >
          −
        </button>
        <span className="w-20 text-center text-2xl font-semibold tabular-nums whitespace-nowrap" aria-live="polite">
          {protein} g
        </span>
        <button
          type="button"
          onClick={() => setProtein((p) => Math.min(220, p + 10))}
          disabled={protein >= 220}
          aria-label="more protein"
          className="flex size-11 items-center justify-center rounded-[12px] border border-rule text-2xl disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* visual echo only — the slider and stepper announce their own values */}
      <PreviewLine budget={budget} protein={protein} items={itemsFor(budget)} className="mt-6 border-t border-rule pt-4" />

      <p className="mt-5 text-caption text-ink-soft">{site.demo.previewNote}</p>
      {/* static band picks, tagged until the real solver drives them (TRUTH-AUDIT row 9) */}
      <div key={bandIdx} data-truth="placeholder" className="demo-fade mt-3 grid grid-cols-2 gap-3">
        {dinners.map((d) => (
          <figure key={d.name} className="flex min-h-24 items-center gap-3">
            <Image src={d.img} alt={d.alt} width={192} height={192} quality={75} sizes="96px" className="img-grade size-24 shrink-0 rounded-[10px] object-cover" />
            <figcaption>
              <p className="text-[0.9375rem] leading-tight font-medium">{d.name}</p>
              <p className="mt-1 text-caption tabular-nums text-ink-soft">${d.price_usd.toFixed(2)}</p>
            </figcaption>
          </figure>
        ))}
        <div className="flex min-h-24 items-center rounded-[10px] bg-bg-alt px-4 text-[0.9375rem] leading-snug text-ink-soft">
          two more dinners in your full week →
        </div>
      </div>

      <div className="mt-6">
        <Link href={`/start?budget=${budget}&protein=${protein}`} className="cta cta-kale">
          {site.demo.cta}
        </Link>
        <p className="mt-3 text-[0.8125rem] text-ink-soft">{site.demo.under}</p>
      </div>
    </div>
  );
}
