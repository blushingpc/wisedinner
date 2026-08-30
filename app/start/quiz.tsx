"use client";

import { Wordmark } from "@/app/wordmark";
import { useState } from "react";
import { DIETS, type Diet, type SolveOutput } from "@/app/api/solve/solver";

const STEPS = 6;

type Answers = {
  budget: string;
  protein: string;
  kcalMin: string;
  kcalMax: string;
  diet: Diet;
  household: string;
  pantry: string[];
};

type Solve = { status: "idle" | "loading" | "error" } | { status: "done"; week: SolveOutput };

const input = "mt-2 w-full rounded-sm border border-rule bg-bg px-4 py-3 font-mono text-4xl tabular-nums";
const label = "block font-mono text-micro uppercase text-ink-soft";
const helper = "mt-2 text-ink-soft";
const cta = "rounded-sm bg-ink px-5 py-3 font-medium text-bg transition duration-200 ease-press hover:bg-ink-press active:scale-[0.98]";
const textLink = "underline decoration-2 underline-offset-[5px]";

export function Quiz({ pantryOptions }: { pantryOptions: string[] }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ budget: "", protein: "", kcalMin: "", kcalMax: "", diet: "none", household: "1", pantry: [] });
  const [error, setError] = useState("");
  const [solve, setSolve] = useState<Solve>({ status: "idle" });

  const set = (patch: Partial<Answers>) => setA({ ...a, ...patch });
  const n = (v: string) => Number(v);

  // the same bounds the api enforces, said in plain words
  const problem = (): string => {
    if (step === 0 && !(n(a.budget) >= 1 && n(a.budget) <= 1000)) return "a number between 1 and 1000, please.";
    if (step === 1 && !(n(a.protein) >= 1 && n(a.protein) <= 400)) return "a number between 1 and 400, please.";
    if (step === 2) {
      if (!(n(a.kcalMin) >= 500 && n(a.kcalMax) <= 6000)) return "both numbers between 500 and 6000, please.";
      if (n(a.kcalMin) > n(a.kcalMax)) return "the low end has to be at or below the high end.";
    }
    if (step === 4 && !(Number.isInteger(n(a.household)) && n(a.household) >= 1 && n(a.household) <= 8)) return "a whole number from 1 to 8, please.";
    return "";
  };

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = problem();
    setError(p);
    if (p) return;
    if (step < STEPS - 1) {
      setStep(step + 1);
      return;
    }
    setSolve({ status: "loading" });
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          budget: n(a.budget),
          protein_per_day: n(a.protein),
          kcal_min: n(a.kcalMin),
          kcal_max: n(a.kcalMax),
          diet: a.diet,
          household: n(a.household),
          pantry: a.pantry,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSolve({ status: "done", week: await res.json() });
    } catch {
      setSolve({ status: "error" });
    }
  };

  const back = () => {
    setError("");
    setStep(step - 1);
  };

  if (solve.status === "done") return <Result week={solve.week} a={a} again={() => setSolve({ status: "idle" })} />;

  return (
    <main id="main" className="mx-auto min-h-dvh max-w-[1200px] px-6 py-10 lg:px-12">
      <div className="fixed inset-x-0 top-0 h-0.5 bg-rule" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-200 ease-press" style={{ width: `${(step / STEPS) * 100}%` }} />
      </div>

      <header className="flex items-baseline justify-between">
        <Wordmark />
        <span className="font-mono text-micro text-ink-soft">
          0{step + 1} / 0{STEPS}
        </span>
      </header>

      <form onSubmit={next} className="mt-20 max-w-[62ch] sm:mt-28" aria-live="polite">
        {step === 0 && (
          <>
            <label htmlFor="budget" className={label}>
              weekly grocery budget, usd
            </label>
            <input id="budget" className={input} inputMode="decimal" autoFocus value={a.budget} onChange={(e) => set({ budget: e.target.value })} aria-describedby="budget-help" />
            <p id="budget-help" className={helper}>
              what you&apos;d spend in the store this week. your number, not ours.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <label htmlFor="protein" className={label}>
              protein per day, grams
            </label>
            <input id="protein" className={input} inputMode="numeric" autoFocus value={a.protein} onChange={(e) => set({ protein: e.target.value })} aria-describedby="protein-help" />
            <p id="protein-help" className={helper}>
              per person. most people here aim for 140 to 160.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="kcal-min" className={label}>
                  calories per day, low end
                </label>
                <input id="kcal-min" className={input} inputMode="numeric" autoFocus value={a.kcalMin} onChange={(e) => set({ kcalMin: e.target.value })} />
              </div>
              <div>
                <label htmlFor="kcal-max" className={label}>
                  high end
                </label>
                <input id="kcal-max" className={input} inputMode="numeric" value={a.kcalMax} onChange={(e) => set({ kcalMax: e.target.value })} />
              </div>
            </div>
            <p className={helper}>per person. a range like 1800 to 2600 gives the solver room.</p>
          </>
        )}
        {step === 3 && (
          <fieldset>
            <legend className={label}>diet</legend>
            <div className="mt-2 grid gap-2">
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
          <>
            <label htmlFor="household" className={label}>
              people eating
            </label>
            <input id="household" className={input} inputMode="numeric" autoFocus value={a.household} onChange={(e) => set({ household: e.target.value })} aria-describedby="household-help" />
            <p id="household-help" className={helper}>
              everyone the list has to feed, you included.
            </p>
          </>
        )}
        {step === 5 && (
          <fieldset>
            <legend className={label}>already in your pantry</legend>
            <p className={helper}>optional. tick what you own a full pack of. the solver uses it for free.</p>
            <div className="mt-4 grid gap-1 sm:grid-cols-2">
              {pantryOptions.map((name) => (
                <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-rule py-2">
                  <input
                    type="checkbox"
                    checked={a.pantry.includes(name)}
                    onChange={(e) => set({ pantry: e.target.checked ? [...a.pantry, name] : a.pantry.filter((p) => p !== name) })}
                    className="size-5 accent-ink"
                  />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="mt-4 font-mono text-spec text-receipt-total">
            {error}
          </p>
        )}
        {solve.status === "error" && (
          <p role="alert" className="mt-4 font-mono text-spec text-receipt-total">
            the solver didn&apos;t answer. check your connection and press the button again.
          </p>
        )}

        <div className="mt-10 flex items-center gap-6">
          <button type="submit" className={cta} disabled={solve.status === "loading"}>
            {step < STEPS - 1 ? "next" : "solve my week"}
          </button>
          {step > 0 && (
            <button type="button" onClick={back} className={textLink}>
              back
            </button>
          )}
        </div>
      </form>

      {solve.status === "loading" && (
        <div className="mt-16 max-w-xs space-y-3" aria-label="solving" role="status">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 animate-pulse bg-rule" style={{ width: `${90 - i * 12}%` }} />
          ))}
        </div>
      )}
    </main>
  );
}

function Result({ week, a, again }: { week: SolveOutput; a: Answers; again: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 lg:px-12">
      <header className="flex items-baseline justify-between">
        <Wordmark />
        <button onClick={again} className={`font-mono text-micro uppercase text-ink-soft ${textLink}`}>
          start over
        </button>
      </header>

      {!week.feasible && (
        <p className="mt-16 max-w-[62ch] text-xl">
          we couldn&apos;t hit {a.protein} g a day for ${a.budget} at those calories. the week below is as close as the
          staple pool gets, short by {week.protein_shortfall_g} g. a higher budget or a lower target usually fixes it.
        </p>
      )}

      <div className="mt-16 grid gap-12 md:grid-cols-[1fr_1.6fr]">
        <div className="w-full max-w-xs bg-receipt-paper px-6 pt-7 pb-6 font-mono text-spec tabular-nums shadow-receipt md:-rotate-[0.5deg]">
          <p className="text-center text-micro uppercase">wisedinner</p>
          <p className="mt-1 text-center text-ink-soft">your week, solved</p>
          <p className="my-4 text-center text-ink-soft">* * *</p>
          {week.list.map((item) => (
            <div key={item.name} className="flex items-baseline py-0.5">
              <span className="uppercase">
                {item.qty > 1 ? `${item.qty}× ` : ""}
                {item.name}
              </span>
              <span className="leader" />
              <span>{item.price_usd === 0 ? "pantry" : `$${item.price_usd.toFixed(2)}`}</span>
            </div>
          ))}
          <div className="my-4 border-t border-dashed border-rule" />
          <div className="flex items-baseline">
            <span className="text-micro uppercase">est. in-store</span>
            <span className="leader" />
            <span className="text-xl font-medium text-receipt-total">${week.est_total.toFixed(2)}</span>
          </div>
          <div className="flex items-baseline py-0.5">
            <span className="uppercase">protein / day</span>
            <span className="leader" />
            <span>{week.protein_per_day} g</span>
          </div>
          <div className="flex items-baseline py-0.5">
            <span className="uppercase">kcal / day</span>
            <span className="leader" />
            <span>{week.kcal_per_day}</span>
          </div>
          <p className="my-4 text-center text-ink-soft">* * *</p>
          <p className="text-center text-ink-soft">prices as of {week.price_as_of}</p>
        </div>

        <div>
          <h1 className="text-h2 font-bold">five days, one trip.</h1>
          <ol className="mt-6 max-w-[62ch]">
            {week.days.map((d) => (
              <li key={d.day} className="border-t border-rule py-4">
                <div className="flex items-baseline justify-between font-mono text-micro uppercase text-ink-soft">
                  <span>{d.day}</span>
                  <span>
                    {d.protein_g} g · {d.kcal} kcal
                  </span>
                </div>
                <p className="mt-1">{d.items.map((i) => `${i.name}, ${i.portion}`).join(" · ")}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
