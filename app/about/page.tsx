import type { Metadata } from "next";
import Link from "next/link";
import { ABOUT } from "@/app/copy";
import { PageShell } from "@/app/ui/page-shell";

export const metadata: Metadata = {
  title: "About",
  description: "Why we built a grocery solver instead of another macro tracker, how two numbers become a solved week, and the three things we refuse to do.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <PageShell title="Groceries, as a math problem">
      <div className="mx-auto max-w-[62ch] space-y-5 text-lg">
        {ABOUT.map((p) => (
          <p key={p.slice(0, 20)}>{p}</p>
        ))}
        <p className="text-ink-2">The WiseDinner team</p>
      </div>
      <p className="mt-10 text-center">
        <Link href="/press" className="text-link inline-flex min-h-11 items-center">
          Press kit
        </Link>
      </p>
    </PageShell>
  );
}
