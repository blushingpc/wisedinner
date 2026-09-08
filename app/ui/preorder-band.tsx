import { APP_STORE_IS_LIVE, PLAY_IS_LIVE } from "@/lib/links";
import { fixtureWeek, usd } from "@/data/fixtures";
import { site } from "@/content/site";
import { StoreBadges } from "./store-badges";
import { WaitlistForm } from "./waitlist-form";

// SECTION 7 — PRE-ORDER BAND (REDESIGN-V3 §4): forest-900, paper type. "pre-order opens on the app store in october";
// mono "release: {RELEASE_DATE}" when set; the badges when their URLs are set, else the early-access form; and this
// week's drop line from the fixture. The mobile sticky bar (WD-03) needs the extra bottom padding on phones.
export function PreorderBand() {
  const live = APP_STORE_IS_LIVE || PLAY_IS_LIVE;
  const t = fixtureWeek.totals;
  return (
    <section id="early-access" className="cv-auto bg-forest py-band pb-36 text-white sm:pb-band">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 lg:grid-cols-[7fr_5fr] lg:items-center lg:px-12">
        <div>
          <h2 className="text-h1 font-bold text-balance">{site.hero.preorderNote}</h2>
          <p className="mt-6 tnum text-[0.9375rem] text-white/80">
            this week&apos;s drop: {t.items} staples · {usd(t.est_total_usd)} · {t.protein_per_day_g}g protein/day
          </p>
        </div>
        <div className="lg:justify-self-end">
          {live ? (
            <StoreBadges placement="final" height={56} dark />
          ) : (
            <div className="w-full max-w-md">
              <WaitlistForm source="final" button="get early access" placement="final" dark />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
