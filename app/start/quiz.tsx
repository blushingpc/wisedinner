"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DIETS, type Diet } from "@/app/api/solve/solver";
import { track } from "@/app/ui/track";

const STEPS = 6;
const BANDS: [string, number, number][] = [
  ["1500 – 2000", 1500, 2000],
  ["1800 – 2400", 1800, 2400],
  ["2200 – 2800", 2200, 2800],
  ["2600 – 3200", 2600, 3200],
];

export type Answers = { budget: number; spend: string; protein: number; band: number; diet: Diet; household: number; pantry: string[] };
const DEFAULTS: Answers = { budget: 60, spend: "", protein: 150, band: 1, diet: "none", household: 1, pantry: [] };
export const KEY = { answers: "wd.answers", plan: "wd.plan" };

const label = "block font-mono text-micro uppercase text-ink-soft";
const helper = "mt-2 text-ink-soft";
const num = "field mt-2 font-mono text-4xl tabular-nums";

export function Quiz({ pantryOptions }: { pantryOptions: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);

  // refresh-safe: answers + step live in sessionStorage (no cookies from us)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY.answers);
      if (saved) {
        const { step: s, ...rest } = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from sessionStorage after mount is the point
        setA({ ...DEFAULTS, ...rest });
        setStep(s ?? 0);
      }
    } catch {}
    track("demo_start");
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY.answers, JSON.stringify({ ...a, step }));
    } catch {}
  }, [a, step]);

  // keyboard-completable: every step starts focused so Enter always submits
  useEffect(() => {
    form.current?.querySelector<HTMLElement>("input:checked, input:not([type=hidden])")?.focus();
  }, [step]);

  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));
  const problem = () => {
    if (step === 0 && !(a.budget >= 30 && a.budget <= 120)) return "a budget between 30 and 120, please.";
    if (step === 0 && a.spend && !(Number(a.spend) >= 1 && Number(a.spend) <= 1000)) return "current spend as a number, or leave it blank.";
    if (step === 1 && !(a.protein >= 80 && a.protein <= 220)) return "a target between 80 and 220, please.";
    return "";
  };

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = problem();
    setError(p);
    if (p) return;
    if (step < STEPS - 1) return setStep(step + 1);
    setStatus("loading");
    try {
      const [, lo, hi] = BANDS[a.band];
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ budget: a.budget, protein_per_day: a.protein, kcal_min: lo, kcal_max: hi, diet: a.diet, household: a.household, pantry: a.pantry }),
      });
      if (!res.ok) throw new Error(String(res.status));
      sessionStorage.setItem(KEY.plan, JSON.stringify({ answers: a, week: await res.json() }));
      track("demo_complete");
      router.push("/plan");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-(--z-sticky) h-0.5 bg-rule" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-200 ease-press" style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
      </div>
      <p className="font-mono text-micro uppercase text-ink-soft">
        0{step + 1} / 0{STEPS}
      </p>

      <form ref={form} onSubmit={next} className="mt-10 max-w-[62ch]" aria-live="polite">
        {step === 0 && (
          <>
            <label htmlFor="budget" className={label}>
              weekly grocery budget, usd
            </label>
            <input id="budget" type="number" min={30} max={120} step={1} className={num} value={a.budget} onChange={(e) => set({ budget: Number(e.target.value) })} />
            <input type="range" min={30} max={120} value={a.budget} onChange={(e) => set({ budget: Number(e.target.value) })} aria-label="weekly budget slider" className="mt-4 h-11 w-full accent-ink" />
            <p className={helper}>what you&apos;d spend in the store this week. your number, not ours.</p>
            <label htmlFor="spend" className={`${label} mt-8`}>
              what you spend now, roughly (optional)
            </label>
            <input id="spend" inputMode="decimal" className="field mt-2 font-mono text-2xl tabular-nums" value={a.spend} onChange={(e) => set({ spend: e.target.value.slice(0, 6) })} aria-describedby="spend-help" />
            <p id="spend-help" className={helper}>per week. only used to project your savings on the next page.</p>
          </>
        )}
        {step === 1 && (
          <>
            <label htmlFor="protein" className={label}>
              protein per day, grams
            </label>
            <input id="protein" type="number" min={80} max={220} className={num} value={a.protein} onChange={(e) => set({ protein: Number(e.target.value) })} />
            <input type="range" min={80} max={220} value={a.protein} onChange={(e) => set({ protein: Number(e.target.value) })} aria-label="protein slider" className="mt-4 h-11 w-full accent-ink" />
            <p className={helper}>per person. most people here aim for 140 to 160.</p>
          </>
        )}
        {step === 2 && (
          <fieldset>
            <legend className={label}>calories per day</legend>
            <p className={helper}>per person. a band gives the solver room.</p>
            <div className="mt-2 grid gap-1">
              {BANDS.map(([name], i) => (
                <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-rule py-2 font-mono text-xl tabular-nums">
                  <input type="radio" name="band" checked={a.band === i} onChange={() => set({ band: i })} className="size-5 accent-ink" />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {step === 3 && (
          <fieldset>
            <legend className={label}>diet</legend>
            <div className="mt-2 grid gap-1">
              {DIETS.map((d) => (
                <label key={d} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-rule py-2 text-xl">
                  <input type="radio" name="diet" value={d} checked={a.diet === d} onChange={() => set({ diet: d })} className="size-5 accent-ink" />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {step === 4 && (
          <fieldset>
            <legend className={label}>people eating</legend>
            <p className={helper}>everyone the list has to feed, you included.</p>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <label key={n} className={`flex size-14 cursor-pointer items-center justify-center rounded-[12px] border font-mono text-2xl tabular-nums ${a.household === n ? "border-ink bg-ink text-bg" : "border-rule"}`}>
                  <input type="radio" name="household" className="sr-only" checked={a.household === n} onChange={() => set({ household: n })} />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {step === 5 && (
          <fieldset>
            <legend className={label}>already in your pantry</legend>
            <p className={helper}>optional. tap what you own a full pack of. the solver uses it for free.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {pantryOptions.map((name) => {
                const on = a.pantry.includes(name);
                return (
                  <label key={name} className={`inline-flex min-h-11 cursor-pointer items-center rounded-[12px] border px-4 ${on ? "border-ink bg-ink text-bg" : "border-rule"}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set({ pantry: e.target.checked ? [...a.pantry, name] : a.pantry.filter((p) => p !== name) })} />
                    {name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {(error || status === "error") && (
          <p role="alert" className="mt-4 font-mono text-spec text-receipt-total">
            {error || "the solver didn't answer. check your connection and press the button again."}
          </p>
        )}

        <div className="mt-10 flex items-center gap-6">
          <button type="submit" className="cta" disabled={status === "loading"}>
            {status === "loading" ? "solving…" : step < STEPS - 1 ? "next" : "solve my week"}
          </button>
          {step > 0 && (
            <button type="button" onClick={() => (setError(""), setStep(step - 1))} className="text-link min-h-11">
              back
            </button>
          )}
        </div>
      </form>

      {status === "loading" && (
        <div className="mt-16 max-w-xs space-y-3" role="status" aria-label="solving">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 animate-pulse bg-rule" style={{ width: `${90 - i * 12}%` }} />
          ))}
        </div>
      )}
    </>
  );
}
