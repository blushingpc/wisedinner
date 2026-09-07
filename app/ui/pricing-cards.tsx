import { Check } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/content/site";

const money = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

// SECTION 5 pricing (REDESIGN-V3 §4, feature inventory §2E): the pre-order build is free; Protein Plan and Autopilot
// are the launch tiers with a 14-day trial in the app. Prices read from content/site.ts and nowhere else (pricing law).
// Marketing shows FREE and LAUNCH; never v1.2.
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const { tiers, free, trial } = site.pricing;
  return (
    <div>
      <p className="max-w-[60ch] text-[1.0625rem] leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">the pre-order build is free:</span> {free.join(" · ")}. no account, nothing to buy in the app.
      </p>
      <div className={`mt-8 grid gap-6 ${compact ? "lg:grid-cols-2" : "lg:grid-cols-2 lg:gap-8"}`}>
        {tiers.map((t) => (
          <div key={t.name} className={`lift rounded-[14px] border bg-white p-6 sm:p-8 ${t.popular ? "border-ink shadow-receipt" : "border-rule"}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[1.5rem] font-bold">{t.name}</h3>
              {t.popular && <span className="rounded-full bg-yolk px-3 py-1 text-caption font-semibold text-ink">most popular</span>}
            </div>
            <p className="mt-2 text-[0.9375rem] text-ink-soft">{t.tagline}</p>
            <p className="mt-6 font-mono">
              <span className="text-[2.75rem] leading-none font-semibold">{money(t.monthly)}</span>
              <span className="text-ink-soft">/mo</span>
            </p>
            <p className="mt-2 font-mono text-spec text-ink-soft">
              or {money(t.yearly)}/yr · {money(t.perMonth)}/mo billed yearly
            </p>
            <ul className="mt-7 grid gap-2.5 border-t border-rule pt-6">
              {t.rows.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-[0.9375rem]">
                  <Check size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-kale" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-caption font-semibold text-kale">{trial}</p>
    </div>
  );
}
