import type { Metadata } from "next";
import { DeviceFrame } from "@/app/ui/device-frame";
import { fixtureWeek, fixtureWeek2 } from "@/data/fixtures";
import { GroceryList, Onboarding, ReceiptReveal, ShareWeek, ThisWeek } from "@/app/screens";

export const metadata: Metadata = { title: "App screens", robots: { index: false, follow: false } };

// design-review surface (REDESIGN-V4 §8): every app screen at frame width, plus the bare 390×844 screens. noindex; not linked.
const SCREENS = [
  ["S5 onboarding", <Onboarding key="s5" />],
  ["S1 this week", <ThisWeek key="s1" week={fixtureWeek} />],
  ["S2 grocery list", <GroceryList key="s2" week={fixtureWeek} />],
  ["S6 regenerate", <ThisWeek key="s6" week={fixtureWeek2} active="thu" />],
  ["S3 share your week", <ShareWeek key="s3" week={fixtureWeek} />],
  ["S4 receipt reveal", <ReceiptReveal key="s4" week={fixtureWeek} />],
] as const;

export default function ScreensPreview() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-14">
      <h1 className="text-h2">App screens</h1>
      <p className="mt-2 text-ink-2">Fixture-fed and props-driven. The Expo app copies these.</p>
      <div className="mt-10 flex flex-wrap gap-10">
        {SCREENS.map(([label, node]) => (
          <figure key={label}>
            <DeviceFrame label={label} widthClass="w-[300px]" chrome={false} ptClass="pt-preview">
              {node}
            </DeviceFrame>
            <figcaption className="mt-3 text-caption font-semibold text-ink-2">{label}</figcaption>
          </figure>
        ))}
      </div>
      {/* bare screens at 390×844 for the store export: no bezel, no shadow */}
      <h2 className="mt-16 text-h2">Bare</h2>
      <div className="mt-6 flex flex-wrap gap-6">
        {SCREENS.map(([label, node]) => (
          <div key={label} className="bare @container w-[390px]">
            <div data-store-shot={label.split(" ")[0]} className="screen relative h-[844px] w-full overflow-hidden rounded-[24px] border border-border bg-white">
              {node}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
