import type { Metadata } from "next";
import Image from "next/image";
import { DeviceFrame } from "@/app/ui/device-frame";
import { ThisWeek } from "@/app/screens";
import { fixtureWeek } from "@/data/fixtures";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "og card — WiseDinner", robots: { index: false, follow: false } };

// OG CARD (REDESIGN-V3 §2B): S1 phone at 3° + two cut-outs on paper, lockup top-left, H1 right — composed from the
// real components at 1200×630 and captured by scripts/og-card.ts into public/og/home.png (satori can't render the
// phone). noindex; not linked.
export default function OgCard() {
  return (
    <div className="og-card relative h-[630px] w-[1200px] overflow-hidden bg-white text-ink" style={{ containerType: "inline-size" }}>
      <div className="absolute left-[56px] top-[44px] inline-flex items-center gap-2 text-[28px] font-bold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element -- static svg */}
        <img src="/logo/wisedinner-mark.svg" alt="" width={30} height={30} />
        wisedinner
      </div>
      <div className="absolute right-[56px] top-[130px] w-[540px]">
        <p className="text-[22px] font-semibold text-forest">{site.hero.eyebrow}</p>
        <h1 className="mt-4 text-[76px] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">{site.hero.h1}</h1>
        <p className="mt-8 text-[24px] font-semibold text-forest">{site.hero.preorderNote}</p>
      </div>
      <div className="absolute left-[130px] top-[112px] w-[300px] rotate-[3deg]">
        <DeviceFrame label="this week" widthClass="w-full" chrome={false} priority sizes="320px">
          <ThisWeek week={fixtureWeek} active="tue" priority />
        </DeviceFrame>
      </div>
      <Image src="/img/cutout-tenders-basket.png" alt="" width={1524} height={1077} priority sizes="300px" className="img-grade absolute bottom-[-30px] left-[-30px] w-[280px] [filter:drop-shadow(0_24px_28px_rgba(27,26,24,0.28))]" />
      <Image src="/img/cutout-smash-burger.png" alt="" width={1600} height={1139} priority sizes="220px" className="img-grade absolute bottom-[40px] left-[360px] w-[200px] [filter:drop-shadow(0_24px_28px_rgba(27,26,24,0.28))]" />
    </div>
  );
}
