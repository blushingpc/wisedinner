"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SolveResponse } from "@/app/api/solve/route";
import { ReceiptCard } from "@/app/ui/receipt-card";
import { WaitlistForm } from "@/app/ui/waitlist-form";
import { track } from "@/app/ui/track";
import { BANDS, KEY, type Answers } from "@/app/start/quiz";

type Session = { answers: Answers; week: SolveResponse };

export function Plan() {
  const router = useRouter();
  const [s, setS] = useState<Session | null>(null);
  const [useClosest, setUseClosest] = useState(false);
  const [printedAt, setPrintedAt] = useState("");
  const [regen, setRegen] = useState<"idle" | "loading" | "done" | "error">("idle");

  // one re-solve with the next seed: same numbers, a different valid week (the solver picks within a 3% cost band)
  const regenerate = async () => {
    if (!s || regen !== "idle") return;
    setRegen("loading");
    try {
      const { answers, week } = s;
      const [, lo, hi] = BANDS[answers.band];
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ budget: answers.budget, protein_per_day: answers.protein, kcal_min: lo, kcal_max: hi, diet: answers.diet, household: answers.household, pantry: answers.pantry, seed: (week.seed ?? 0) + 1 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const next = { answers, week: (await res.json()) as SolveResponse };
      sessionStorage.setItem(KEY.plan, JSON.stringify(next));
      setS(next);
      setUseClosest(false);
      setRegen("done");
    } catch {
      setRegen("error");
    }
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY.plan);
      if (!raw) return router.replace("/start");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from sessionStorage after mount is the point
      setS(JSON.parse(raw));
      setPrintedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase());
      track("reveal_view");
    } catch {
      router.replace("/start");
    }
  }, [router]);

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

      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div data-reveal>
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
                    <li key={i.unit}>
                      <span className="font-mono text-micro uppercase text-ink-soft">{i.unit} </span>
                      {i.name}
                      <span className="text-ink-soft"> · {i.portion} · {i.protein_g} g</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
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
            <h2 className="text-2xl font-medium">get early access</h2>
            <p className="mt-2 text-ink-soft">we save this plan with your email. the app picks it up on day one.</p>
            <div className="mt-6">
              <WaitlistForm source="plan" quiz={{ ...answers, est_total: week.est_total, feasible: week.feasible }} />
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule bg-bg/96">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3 lg:px-12">
          <p className="font-mono tabular-nums">
            <span className="text-micro uppercase text-ink-soft">est. in-store </span>
            <span className="text-xl font-medium">${week.est_total.toFixed(2)}</span>
          </p>
          <a href="#early-access" className="cta">
            get early access
          </a>
        </div>
      </div>
    </>
  );
}
