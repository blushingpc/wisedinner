import raw from "@/data/testers.json" with { type: "json" };
import { site } from "@/content/site";
import { Section, SectionHeading } from "./section";

// SECTION 4 (REDESIGN-V4 §6): centered H2, six placeholder cards with initial avatars in two staggered rows, white
// cards on the gray surface. No stars, no rating counts. Placeholder entries render ONLY behind
// NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF (unset in production; CLAUDE.md "External rules", FTC).
type Tester = { name: string; role: string; quote: string };
const TESTERS = raw as Tester[];
const SHOW = process.env.NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF === "true";

export function Testers() {
  if (!SHOW || TESTERS.length === 0) return null;
  return (
    <Section alt lazy>
      <SectionHeading sub={site.testers.sub}>{site.testers.h2}</SectionHeading>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
        {TESTERS.map((t, i) => (
          <li key={t.name} className={`lift rounded-card border border-border bg-white p-6 ${i % 3 === 1 ? "lg:mt-8" : ""}`}>
            <p className="text-[1.0625rem] leading-relaxed text-balance">{t.quote}</p>
            <div className="mt-5 flex items-center gap-3">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-tint text-[0.875rem] font-semibold text-forest">
                {t.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold">{t.name}</p>
                <p className="truncate text-caption text-ink-2">{t.role}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
