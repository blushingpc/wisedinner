import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, faqLd } from "@/app/copy";
import { Accordion } from "@/app/ui/accordion";
import { Section } from "@/app/ui/section";

export const metadata: Metadata = {
  title: "FAQ — WiseDinner",
  description: "when the app launches, what it costs, how accurate the shelf prices are, why not just ask a chatbot, and what we do with your data — answered plainly.",
  alternates: { canonical: "/faq" },
};

export default function Faq() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(faqLd(FAQ))}</script>
      <Section>
        <p className="font-mono text-micro uppercase text-green-600">faq</p>
        <h1 className="mt-4 text-display font-bold">questions.</h1>
        <div className="mt-10 max-w-[70ch]">
          <Accordion items={FAQ} />
        </div>
        <p className="mt-10 text-ink-soft">
          something else?{" "}
          <Link href="/support" className="text-link">
            ask support
          </Link>
          .
        </p>
      </Section>
    </main>
  );
}
