import type { Metadata } from "next";
import { Suspense } from "react";
import { AppStoreBadge } from "@/app/ui/app-store-badge";
import { APP_STORE_IS_LIVE } from "@/lib/links";
import { Plan } from "./plan";

export const metadata: Metadata = { title: "Your week, solved — WiseDinner", robots: { index: false, follow: false } };

export default function PlanPage() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 pb-32 lg:px-12">
      {/* Plan reads ?p= on the client; the boundary keeps the shell static. the badge is server-only (node:fs), so it
          travels in as a slot and Plan shows it only once there is a week to pre-order for. */}
      <Suspense>
        <Plan
          badge={
            <div className="mb-10">
              <AppStoreBadge placement="plan" />
              {APP_STORE_IS_LIVE && <p className="mt-3 text-[1rem] font-semibold">pre-order — this week will be in your app on day one.</p>}
            </div>
          }
        />
      </Suspense>
    </main>
  );
}
