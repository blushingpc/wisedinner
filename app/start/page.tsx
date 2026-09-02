import type { Metadata } from "next";
import { Suspense } from "react";
import { staples } from "@/data/staples";
import { Quiz } from "./quiz";

export const metadata: Metadata = {
  title: "Solve my week — WiseDinner",
  description: "60 seconds: your budget, your protein target, your solved week.",
  alternates: { canonical: "/start" },
};

export default async function Start({ searchParams }: { searchParams: Promise<{ budget?: string; protein?: string }> }) {
  // §9.5 inline demo carries its values here; clamp to the quiz's own ranges
  const sp = await searchParams;
  const inRange = (v: string | undefined, lo: number, hi: number) => {
    const n = Number(v);
    return v && n >= lo && n <= hi ? n : undefined;
  };
  const initial = { budget: inRange(sp.budget, 30, 120), protein: inRange(sp.protein, 80, 220) };
  // top 12 pantry candidates: shelf-stable staples by protein per dollar
  const pantryOptions = staples
    .filter((s) => !s.perishable)
    .sort((a, b) => b.protein_g / b.price_usd - a.protein_g / a.price_usd)
    .slice(0, 12)
    .map((s) => s.name);
  return (
    <main id="main" className="mx-auto min-h-[70dvh] max-w-[1200px] px-6 py-10 lg:px-12">
      <noscript>
        <p className="text-xl">the demo needs javascript.</p>
      </noscript>
      {/* Quiz reads ?step= on the client (WD-05) */}
      <Suspense>
        <Quiz pantryOptions={pantryOptions} initial={initial} />
      </Suspense>
    </main>
  );
}
