import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixtureWeek, fixtureWeek2 } from "@/data/fixtures";
import { GroceryList, Onboarding, ReceiptReveal, ShareWeek, ThisWeek } from "@/app/screens";

export const metadata: Metadata = { title: "store shot — WiseDinner", robots: { index: false, follow: false } };

// STORE SCREENSHOT EXPORT (REDESIGN-V3 §5): one bare screen (no bezel) under a one-line Bricolage caption band on
// paper, laid out at 1290×2796 CSS px; scripts/store-shots.ts captures each at DPR 1 → public/store/. The screen's
// --pt re-bases to 1/390 of the container, so type and spacing scale exactly 3.3× (the App Store 6.9" size).
const SHOTS = [
  ["s5", "$40 in. week out.", <Onboarding key="s5" value="$40" />],
  ["s1", "a solved week.", <ThisWeek key="s1" week={fixtureWeek} />],
  ["s2", "one list. one trip.", <GroceryList key="s2" week={fixtureWeek} />],
  ["s6", "don’t love it? regenerate.", <ThisWeek key="s6" week={fixtureWeek2} active="thu" />],
  ["s3", "share it. beat it.", <ShareWeek key="s3" week={fixtureWeek} />],
  ["s4", "prove it with your receipt.", <ReceiptReveal key="s4" week={fixtureWeek} />],
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
    <div className="store-shot flex h-[2796px] w-[1290px] flex-col bg-bg text-ink" style={{ containerType: "inline-size" }}>
      <p className="px-[100px] pt-[150px] pb-[90px] text-center text-[92px] leading-[1.05] font-bold tracking-[-0.03em] text-balance">{caption}</p>
      <div className="bare @container mx-auto w-[1290px] flex-1">
        <div className="screen relative h-full w-full overflow-hidden">{node}</div>
      </div>
    </div>
  );
}
