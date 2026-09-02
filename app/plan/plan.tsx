"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { SolveResponse } from "@/app/api/solve/route";
import { ReceiptCard } from "@/app/ui/receipt-card";
import { WaitlistForm } from "@/app/ui/waitlist-form";
import { track } from "@/app/ui/track";
import { BANDS, KEY, decodeAnswers, encodeAnswers, type Answers } from "@/app/start/quiz";

type Session = { answers: Answers; week: SolveResponse };

async function solve(answers: Answers, seed?: number): Promise<SolveResponse> {
  const [, lo, hi] = BANDS[answers.band];
  const res = await fetch("/api/solve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ budget: answers.budget, protein_per_day: answers.protein, kcal_min: lo, kcal_max: hi, diet: answers.diet, household: answers.household, pantry: answers.pantry, ...(seed !== undefined && { seed }) }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// honest photos only: exact template-name matches to photography we own — never a look-alike (truth law)
const MEAL_IMG: Record<string, { src: string; alt: string }> = {
  "chicken thigh rice bowl": { src: "/img/meal-chicken-bowl.jpg", alt: "ceramic bowl of sliced roasted chicken thigh over white rice with charred broccoli" },
  "greek yogurt oat parfait": { src: "/img/meal-yogurt-parfait.jpg", alt: "glass of plain greek yogurt layered with oats and banana slices" },
  "black bean egg bowl": { src: "/img/meal-bean-bowl.jpg", alt: "bowl of black beans and rice topped with halved boiled eggs" },
};

export function Plan({ badge }: { badge: ReactNode }) {
  const router = useRouter();
  const p = useSearchParams().get("p");
  const [s, setS] = useState<Session | null>(null);
  const [state, setState] = useState<"loading" | "empty" | "error" | "ready">("loading");
  const [useClosest, setUseClosest] = useState(false);
  const [printedAt, setPrintedAt] = useState("");
  const [regen, setRegen] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [showMath, setShowMath] = useState(false);

  const show = (next: Session) => {
    sessionStorage.setItem(KEY.plan, JSON.stringify(next));
    setS(next);
    setState("ready");
    // the URL is the share link: answers + the seed that picked this week (WD-06)
    const q = encodeAnswers(next.answers, next.week.seed);
    if (q !== p) router.replace(`/plan?p=${q}`, { scroll: false });
  };

  // one re-solve with the next seed: same numbers, a different valid week (the solver picks within a 3% cost band)
  const regenerate = async () => {
    if (!s || regen !== "idle") return;
    setRegen("loading");
    try {
      show({ answers: s.answers, week: await solve(s.answers, (s.week.seed ?? 0) + 1) });
      setUseClosest(false);
      setRegen("done");
    } catch {
      setRegen("error");
    }
  };

  // ?p= wins (a shared or reopened link re-solves — the solver is deterministic), the session is the fast path,
  // and with neither we say so instead of bouncing to the quiz (WD-06)
  useEffect(() => {
    let cached: Session | null = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(KEY.plan) ?? "null");
    } catch {}
    const fromUrl = p ? decodeAnswers(p) : null;
    const done = (next: Session) => {
      show(next);
      setPrintedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase());
      track("reveal_view");
    };
    if (fromUrl) {
      const { seed, ...answers } = fromUrl;
      if (cached && encodeAnswers(cached.answers, cached.week.seed) === p) return done(cached);
      solve(answers, seed)
        .then((week) => done({ answers, week }))
        .catch(() => setState("error"));
      return;
    }
    if (cached) return done(cached);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the session after mount is the point
    setState("empty");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per ?p; show() only rewrites the URL
  }, [p]);

  if (state === "empty" || state === "error") {
    return (
      <div className="max-w-[46ch]">
        <h1 className="text-h2 font-bold text-balance">{state === "empty" ? "that plan’s gone." : "the solver didn’t answer."}</h1>
        <p className="mt-4 text-ink-soft">
          {state === "empty"
            ? "plans live in your browser, not our servers. solving a new one takes about 60 seconds."
            : "check your connection and reload this link, or solve a fresh week — it takes about 60 seconds."}
        </p>
        <Link href="/start" className="cta mt-8">
          solve my week →
        </Link>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="max-w-xs space-y-3" role="status" aria-label="loading your plan">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 animate-pulse bg-rule" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    );
  }

  const { answers, week: solved } = s;
  const week = useClosest && solved.closest ? solved.closest.week : solved;
  const protein = useClosest && solved.closest ? solved.closest.protein_per_day : answers.protein;
  const spend = Number(answers.spend);
  const monthly = spend > 0 ? Math.round((spend - week.est_total) * 4.33) : null;

  return (
    <>
      {badge}
      {!week.feasible && (
        <div className="mb-10 max-w-[62ch] border-l-2 border-accent pl-5">
          <p className="text-xl">
            at ${answers.budget}/week, {answers.protein}g/day isn&apos;t solvable at today&apos;s prices.
            {solved.closest ? ` closest solvable: ${solved.closest.protein_per_day}g/day for $${solved.closest.week.est_total.toFixed(2)}.` : " the week below is as close as the staple pool gets."}
          </p>
          {solved.closest && (
            <button type="button" onClick={() => setUseClosest(true)} className="cta mt-4">
              use closest
            </button>
          )}
        </div>
      )}

      {/* scorecard: checks are computed, not decorative — truth law */}
      <dl className="mb-8 grid grid-cols-3 gap-2 sm:max-w-lg">
        {[
          [week.est_total <= answers.budget, "budget", week.est_total <= answers.budget ? `$${week.est_total.toFixed(2)} under $${answers.budget}` : `over by $${(week.est_total - answers.budget).toFixed(2)}`],
          [week.protein_per_day >= protein, "protein", week.protein_per_day >= protein ? `${week.protein_per_day} g / day` : `${week.protein_per_day} of ${protein} g`],
          [true, "waste", "0 lb by design"],
        ].map(([met, label, detail]) => (
          <div key={label as string} className={`rounded-[14px] border px-3 py-2 ${met ? "border-rule bg-green-050" : "border-rule"}`}>
            <dt className="font-mono text-micro uppercase text-ink-soft">
              <span aria-hidden="true" className={met ? "text-green-600" : "text-ink-soft"}>{met ? "✓ " : "— "}</span>
              {label as string}
            </dt>
            <dd className="mt-0.5 font-mono text-spec tabular-nums">{detail as string}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        {/* receipt beside the day cards on desktop, beneath them on mobile */}
        <div data-reveal className="order-last lg:order-first">
          <ReceiptCard week={week} variant="plan" printedAt={printedAt} tilt />
        </div>
        <div>
          <h1 className="text-h2 font-bold">five days, one trip.</h1>
          <p className="mt-3 text-ink-soft">
            {week.distinct_skus} items · {week.protein_sources} protein sources · {protein} g protein a day, {answers.household} {answers.household === 1 ? "person" : "people"}, est. in-store. prices as of {week.price_as_of}.
          </p>
          {monthly !== null && (
            <dl className="mt-8 border-t border-rule py-4 font-mono tabular-nums">
              <dd className={`text-4xl font-medium ${monthly >= 0 ? "text-accent" : ""}`}>
                {monthly >= 0 ? "" : "−"}${Math.abs(monthly)}
              </dd>
              <dt className="mt-1 text-micro uppercase text-ink-soft">projected monthly savings vs the ${spend}/week you told us</dt>
            </dl>
          )}
          {showMath ? (
            <ol className="mt-8">
              {week.days.map((d) => (
                <li key={d.day} className="border-t border-rule py-4">
                  <div className="flex items-baseline justify-between font-mono text-micro uppercase text-ink-soft">
                    <span>{d.day}</span>
                    <span>
                      {d.protein_g} g · {d.kcal} kcal
                    </span>
                  </div>
                  <ol className="mt-1 grid gap-1">
                    {d.items.map((i) => (
                      <li key={i.unit} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-2">
                        <span className="font-mono text-micro uppercase text-ink-soft">{i.unit}</span>
                        <span>
                          {i.name}
                          <span className="block font-mono text-micro text-ink-soft">{i.portion}</span>
                        </span>
                        <span className="font-mono text-spec tabular-nums text-ink-soft">{i.protein_g} g</span>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="mt-8 grid gap-3">
              {week.days.map((d) => (
                <li key={d.day} className="rounded-[14px] border border-rule bg-bg px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-micro uppercase text-ink-soft">{d.day}</span>
                    <span className="font-mono text-spec tabular-nums text-ink-soft">{d.protein_g} g protein</span>
                  </div>
                  {/* TODO(launch): show one price per day once the solver returns per-day cost */}
                  <ol className="mt-2 grid gap-2">
                    {d.items.map((i) => {
                      const img = MEAL_IMG[i.name];
                      return (
                        <li key={i.unit} className="flex items-center gap-3">
                          {img && <Image src={img.src} alt={img.alt} width={192} height={192} quality={75} sizes="96px" className="img-grade size-24 shrink-0 rounded-[10px] object-cover" />}
                          <span className="font-medium">{i.name}</span>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>
          )}
          <button type="button" onClick={() => setShowMath(!showMath)} aria-pressed={showMath} className="text-link mt-4 min-h-11">
            {showMath ? "hide the math" : "show the math"}
          </button>
          <div className="mt-8 flex flex-wrap gap-6">
            {regen !== "done" && (
              <button type="button" onClick={regenerate} disabled={regen === "loading"} className="text-link min-h-11">
                {regen === "loading" ? "re-solving…" : regen === "error" ? "regenerate (try again)" : "regenerate"}
              </button>
            )}
            <Link href="/start" className="text-link inline-flex min-h-11 items-center">
              change my numbers
            </Link>
            <Link href="/drop" className="text-link inline-flex min-h-11 items-center">
              see this week&apos;s free drop
            </Link>
          </div>
          <div id="early-access" className="mt-14 border-t border-rule pt-8">
            <h2 className="text-2xl font-medium">save this week to your phone</h2>
            <div className="mt-6">
              <WaitlistForm source="plan" button="save my week" quiz={{ ...answers, est_total: week.est_total, feasible: week.feasible }} />
            </div>
          </div>
        </div>
      </div>

      <div className="chrome fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3 lg:px-12">
          <p className="font-mono tabular-nums">
            <span className="text-micro uppercase text-ink-soft">est. in-store </span>
            <span className="text-xl font-medium">${week.est_total.toFixed(2)}</span>
          </p>
          <a href="#early-access" className="cta">
            save this week
          </a>
        </div>
      </div>
    </>
  );
}
