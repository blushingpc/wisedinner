import type { Metadata } from "next";
import { DeviceFrame } from "@/app/ui/device-frame";
import { Lockup } from "@/app/lockup";
import { ThisWeek } from "@/app/screens";
import { fixtureWeek } from "@/data/fixtures";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "OG card", robots: { index: false, follow: false } };

// OG CARD (REDESIGN-V4 §2D, App Store-card style): white field, the lockup top-left at 40px, one large S1 phone
// centered-right at a 4° tilt on a soft contact shadow, the headline left in Plus Jakarta 800 with the sub in Inter
// 500 beneath, nothing else. composed from the real components at 1200×630 and captured by scripts/og-card.ts into
// public/og/home.png (satori cannot render the phone). noindex; not linked.
export default function OgCard() {
  return (
    <div className="og-card relative h-[630px] w-[1200px] overflow-hidden bg-white text-ink" style={{ containerType: "inline-size" }}>
      <div className="absolute left-[40px] top-[40px]">
        <Lockup size={34} />
      </div>
      <div className="absolute left-[40px] top-[190px] w-[560px]">
        <h1 className="text-[68px] leading-[1.05] tracking-[-0.02em] text-balance">{site.hero.h1}</h1>
        <p className="mt-6 max-w-[26ch] text-[24px] leading-[1.4] font-medium text-ink-2">{site.hero.lede}</p>
      </div>
      {/* the phone: 300px wide, 4° tilt, the one ambient shadow plus a contact ellipse so it rests on the field */}
      <div className="contact-shadow absolute right-[150px] top-[80px] w-[300px] rotate-[4deg]">
        <DeviceFrame label="This week" widthClass="w-full" chrome={false} priority sizes="320px">
          <ThisWeek week={fixtureWeek} active="tue" priority />
        </DeviceFrame>
      </div>
    </div>
  );
}
