import { Check } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/content/site";

const money = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

// SECTION 5 pricing (REDESIGN-V4 §6, FRONTEND-V4.1 §4): the pre-order build is free and complete; Protein Plan and
// Autopilot are the launch tiers, each led by the one control it adds, with a 14-day trial in the app. Prices read
// from content/site.ts and nowhere else (pricing law). No ratings language anywhere in this section.
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const { tiers, intro, trial } = site.pricing;
  return (
    <div>
      <p className="mx-auto max-w-[60ch] text-center text-[1.0625rem] leading-relaxed text-ink-2">{intro}</p>
      <div className={`mx-auto mt-10 grid max-w-[880px] gap-5 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 md:gap-6"}`}>
        {tiers.map((t) => (
          <div key={t.name} className={`lift flex flex-col rounded-card bg-white p-6 sm:p-8 ${t.popular ? "shadow-card ring-2 ring-forest" : "border border-border"}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-h3">{t.name}</h3>
              {t.popular && <span className="shrink-0 rounded-full bg-forest px-3 py-1 text-caption font-semibold text-white">Most popular</span>}
            </div>
            <p className="mt-2 text-[0.9375rem] text-ink-2">{t.tagline}</p>
            <p className="mt-6 tnum">
              <span className="text-[2.75rem] leading-none font-semibold tracking-[-0.02em]">{money(t.monthly)}</span>
              <span className="text-ink-2">/month</span>
            </p>
            <p className="mt-2 text-sm text-ink-2 tnum">
              or {money(t.yearly)}/year, {money(t.perMonth)} a month billed yearly
            </p>
            {/* the lead: the control this tier hands you, on the emerald tint */}
            <div className="mt-7 rounded-[12px] bg-emerald-tint p-4">
              <p className="font-display text-[1.0625rem] font-bold tracking-[-0.01em]">{t.lead.title}</p>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2">{t.lead.body}</p>
            </div>
            <ul className="mt-6 grid gap-2.5 border-t border-border pt-6">
              {t.rows.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-[0.9375rem]">
                  <Check size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-emerald" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-caption font-medium text-ink-2">{trial}</p>
    </div>
  );
}
