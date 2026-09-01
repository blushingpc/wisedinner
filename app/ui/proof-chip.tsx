import { site } from "@/content/site";

const n = (v: number) => v.toLocaleString("en-US");

// hero proof chip — first real proof point wins; never empty (falls back to product facts).
// counts render only from real content values (>= 100), never samples.
export function ProofChip({ className = "" }: { className?: string }) {
  const { proof, launchWindow, hero } = site;
  const text =
    proof.preorders >= 100
      ? `${n(proof.preorders)} people pre-ordered`
      : proof.demoWeeksThisMonth >= 100
        ? `${n(proof.demoWeeksThisMonth)} weeks solved in the demo this month`
        : launchWindow
          ? `launching ${launchWindow}`
          : hero.proofFacts;
  return (
    <p className={`inline-flex items-center rounded-full border border-rule bg-bg-alt px-3 py-1 text-caption font-semibold text-kale ${className}`}>
      {text}
    </p>
  );
}
