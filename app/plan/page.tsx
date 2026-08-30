import type { Metadata } from "next";
import { Plan } from "./plan";

export const metadata: Metadata = { title: "Your week, solved — WiseDinner", robots: { index: false, follow: false } };

export default function PlanPage() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 pb-32 lg:px-12">
      <Plan />
    </main>
  );
}
