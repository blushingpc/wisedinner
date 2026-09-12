import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixtureWeek, fixtureWeek2 } from "@/data/fixtures";
import { budgetUsd } from "@/lib/showcase";
import { DeviceFrame } from "@/app/ui/device-frame";
import { GroceryList, Onboarding, ReceiptReveal, ShareWeek, ThisWeek } from "@/app/screens";

export const metadata: Metadata = { title: "Store shot", robots: { index: false, follow: false } };

// STORE SCREENSHOT EXPORT (REDESIGN-V4 §8): Cal AI's format on a forest field, one title above a centered phone per
// shot, laid out at 1290×2796 CSS px; scripts/store-shots.ts captures each at DPR 1 into public/store/. The phone is
// 1000px wide, so one screen point is 2.29px and the 56pt thumbnails render at 128px (imgSizes below).
const SHOTS = [
  ["s5", "Two numbers in. A week out.", <Onboarding key="s5" value={budgetUsd(fixtureWeek.budget_usd)} />],
  ["s1", "Plan the week in a minute.", <ThisWeek key="s1" week={fixtureWeek} imgSizes="128px" />],
  ["s2", "One list. One trip.", <GroceryList key="s2" week={fixtureWeek} />],
  ["s6", "Nothing goes to waste.", <ThisWeek key="s6" week={fixtureWeek2} active="thu" imgSizes="128px" />],
  ["s3", "Share it. Beat it.", <ShareWeek key="s3" week={fixtureWeek} imgSizes="128px" />],
  ["s4", "Prove it with your receipt.", <ReceiptReveal key="s4" week={fixtureWeek} />],
] as const;

export function generateStaticParams() {
  return SHOTS.map(([screen]) => ({ screen }));
}
export const dynamicParams = false;

export default async function StoreShot({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  const shot = SHOTS.find(([s]) => s === screen);
  if (!shot) notFound();
  const [, caption, node] = shot;
  return (
    <div className="store-shot flex h-[2796px] w-[1290px] flex-col items-center bg-forest text-white">
      <h1 className="px-[120px] pt-[170px] pb-[110px] text-center text-[96px] leading-[1.08] text-white text-balance">{caption}</h1>
      <DeviceFrame label={caption} widthClass="w-[1000px]" chrome={false} priority ptClass="pt-store" sizes="1000px" className="shrink-0">
        {node}
      </DeviceFrame>
    </div>
  );
}
