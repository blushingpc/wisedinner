import type { Metadata } from "next";
import { Lockup } from "@/app/lockup";

export const metadata: Metadata = { title: "Lockup", robots: { index: false, follow: false } };

// LOCKUP EXPORT (REDESIGN-V4 §2B): the lockup rendered large on white for the press kit; scripts/og-card.ts captures
// `.lockup-card` at 2x into public/press/wisedinner-lockup.png. noindex; not linked.
export default function LockupExport() {
  return (
    <div className="lockup-card grid h-[400px] w-[1200px] place-items-center bg-white">
      <Lockup size={120} />
    </div>
  );
}
