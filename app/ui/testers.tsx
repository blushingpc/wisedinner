import raw from "@/data/testers.json" with { type: "json" };

// SECTION 4 — "what our testers say" (REDESIGN-V3 §2D/§4): six text-led cards in a staggered two-row grid with
// initial-avatar tiles. No stars, no rating counts. Placeholder entries render ONLY behind
// NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF (unset in production — CLAUDE.md "External rules", FTC).
type Tester = { name: string; role: string; quote: string };
const TESTERS = raw as Tester[];
const SHOW = process.env.NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF === "true";

export function Testers() {
  if (!SHOW || TESTERS.length === 0) return null;
  return (
    <section className="py-band">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <h2 className="text-h2 font-bold text-balance">what our testers say</h2>
        <p className="mt-2 text-caption font-semibold text-ink-soft">people running the early build</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
          {TESTERS.map((t, i) => (
            <li key={t.name} className={`lift rounded-[14px] border border-rule bg-white p-6 ${i % 3 === 1 ? "lg:mt-8" : ""}`}>
              <p className="text-[1.0625rem] leading-relaxed text-balance">“{t.quote}”</p>
              <div className="mt-5 flex items-center gap-3">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-bg-alt text-[0.875rem] font-bold text-kale">
                  {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold">{t.name}</p>
                  <p className="truncate text-caption text-ink-soft">{t.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
