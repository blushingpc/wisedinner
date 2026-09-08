import { Check } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/content/site";

const money = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

// SECTION 5 pricing (REDESIGN-V4 §6, §7): the pre-order build is free; Protein Plan and Autopilot are the launch tiers
// with a 14-day trial in the app. Prices read from content/site.ts and nowhere else (pricing law).
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const { tiers, free, trial } = site.pricing;
  return (
    <div>
      <p className="mx-auto max-w-[60ch] text-center text-[1.0625rem] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">The pre-order build is free:</span> {free.join(", ")}. No account, nothing to buy in the app.
      </p>
      <div className={`mx-auto mt-10 grid max-w-[880px] gap-5 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 md:gap-6"}`}>
        {tiers.map((t) => (
          <div key={t.name} className={`lift rounded-card bg-white p-6 sm:p-8 ${t.popular ? "shadow-card ring-2 ring-forest" : "border border-border"}`}>
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
            <ul className="mt-7 grid gap-2.5 border-t border-border pt-6">
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
