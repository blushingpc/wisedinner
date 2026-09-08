import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, faqLd } from "@/app/copy";
import { Accordion } from "@/app/ui/accordion";
import { PageShell } from "@/app/ui/page-shell";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: "When the app launches, what it costs, how accurate the shelf prices are, and what we do with your data, answered plainly.",
  alternates: { canonical: "/faq" },
};

export default function Faq() {
  return (
    <PageShell title={site.faq.h2}>
      <script type="application/ld+json">{JSON.stringify(faqLd(FAQ))}</script>
      <Accordion items={FAQ} />
      <p className="mt-10 text-center text-ink-2">
        Something else?{" "}
        <Link href="/support" className="text-link text-ink">
          Ask support
        </Link>
        .
      </p>
    </PageShell>
  );
}
