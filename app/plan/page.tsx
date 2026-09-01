import type { Metadata } from "next";
import { AppStoreBadge } from "@/app/ui/app-store-badge";
import { Plan } from "./plan";

export const metadata: Metadata = { title: "Your week, solved — WiseDinner", robots: { index: false, follow: false } };

export default function PlanPage() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 pb-32 lg:px-12">
      <div className="mb-10">
        <AppStoreBadge placement="plan" />
        <p className="mt-3 text-[1rem] font-semibold">pre-order — this week will be in your app on day one.</p>
      </div>
      <Plan />
    </main>
  );
}
