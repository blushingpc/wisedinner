import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "./ui/page-shell";

// the 404 carries its own title. Next already emits noindex and a real 404 status.
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageShell title="This page does not exist" sub="Error 404. The link may be old, or the address may have a typo." className="min-h-[50dvh]">
      <div className="flex justify-center">
        <Link href="/" className="cta">
          Back home
        </Link>
      </div>
    </PageShell>
  );
}
