import type { Metadata } from "next";
import { staples } from "@/data/staples";
import { Quiz } from "./quiz";

export const metadata: Metadata = {
  title: "Solve my week — WiseDinner",
  description: "60 seconds: your budget, your protein target, your solved week.",
  alternates: { canonical: "/start" },
};

export default function Start() {
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
      <Quiz pantryOptions={pantryOptions} />
    </main>
  );
}
