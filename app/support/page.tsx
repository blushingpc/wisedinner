import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/app/copy";
import { Section } from "@/app/ui/section";
import { SupportForm } from "./form";

export const metadata: Metadata = {
  title: "Support — WiseDinner",
  description: "Email us or send a message. We read everything, usually within a day.",
  alternates: { canonical: "/support" },
};

export default function Support() {
  return (
    <main id="main">
      <Section className="grid gap-12 lg:grid-cols-2">
        <div>
          <p className="font-mono text-micro uppercase text-ink-soft">support</p>
          <h1 className="mt-4 text-display font-bold">talk to a person.</h1>
          <p className="mt-6 max-w-[62ch] text-xl text-ink-soft">
            email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link text-ink">
              {SUPPORT_EMAIL}
            </a>{" "}
            or use the form. to see or delete your data, say so and we confirm within 7 days.
          </p>
        </div>
        <SupportForm />
      </Section>
    </main>
  );
}
