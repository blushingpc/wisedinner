import { fixtureWeek, usd } from "@/data/fixtures";
import { site } from "@/content/site";
import { StoreBadges } from "./store-badges";

// SECTION 7, THE PRE-ORDER BAND (REDESIGN-V4 §6): forest field, white type. H2 "Pre-order on the App Store in October",
// "Release: {date}" when set, both badges, and this week's plan from the fixture. The mobile sticky bar needs the
// extra bottom padding on phones. `early-access` is the anchor every text CTA points at while the listing is not live.
export function PreorderBand() {
  const t = fixtureWeek.totals;
  return (
    <section id="early-access" className="cv-auto bg-forest py-band pb-36 text-white sm:pb-band">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center px-6 text-center lg:px-12">
        <h2 className="max-w-[18ch] text-h2 text-white text-balance lg:text-[2.75rem]">{site.preorder.h2}</h2>
        <StoreBadges placement="final" height={48} dark className="mt-8 justify-center" />
        <p className="mt-8 text-[0.9375rem] text-white/80 tnum">
          This week&apos;s plan: {t.items} items, {usd(t.est_total_usd)}, {t.protein_per_day_g}g of protein a day
        </p>
      </div>
    </section>
  );
}
