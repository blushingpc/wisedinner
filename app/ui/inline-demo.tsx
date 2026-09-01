"use client";

import Link from "next/link";
import { useState } from "react";

// mirrors floors() in app/api/solve/solver.ts (client bundle stays free of solver+staples)
const itemsFor = (budget: number) => Math.round(8 + 4 * Math.min(1, Math.max(0, (budget - 30) / 25)));

const num = "font-semibold tabular-nums";

// §9.5 inline demo — step one of /start embedded, values carried over via query params
export function InlineDemo() {
  const [budget, setBudget] = useState(60);
  const [protein, setProtein] = useState(150);

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
        <span className={`${num} w-14 shrink-0 text-right text-2xl`}>${budget}</span>
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
        <span className={`${num} w-20 text-center text-2xl whitespace-nowrap`} aria-live="polite">
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
      <p className="mt-6 border-t border-rule pt-4 text-ink-soft">
        <span className={`${num} text-ink`}>${budget}</span> → 5 dinners ·{" "}
        <span className={`${num} text-ink`}>{protein} g</span> a day · ~
        <span className={`${num} text-ink`}>{itemsFor(budget)}</span> items
      </p>

      <div className="mt-6">
        <Link href={`/start?budget=${budget}&protein=${protein}`} className="cta cta-kale">
          solve my week
        </Link>
        <p className="mt-3 text-caption text-ink-soft">no account. takes a minute.</p>
        <p className="mt-1 text-[0.8125rem] text-ink-soft">your solved week will be in the app on day one.</p>
      </div>
    </div>
  );
}
