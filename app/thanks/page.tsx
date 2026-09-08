import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/app/ui/page-shell";

export const metadata: Metadata = { title: "You are in", robots: { index: false, follow: false } };

export default async function Thanks({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  const position = Number(n);
  return (
    <PageShell title={position > 0 ? `You are in. Number ${position} on the list.` : "You are in."} sub="One email when the app is ready. Nothing before that." className="min-h-[50dvh]">
      <p className="text-center text-ink-2">
        While you wait,{" "}
        <Link href="/drop" className="text-link text-ink">
          see this week&apos;s plan
        </Link>
        .
      </p>
    </PageShell>
  );
}
