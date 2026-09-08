import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/app/copy";
import { PageShell } from "@/app/ui/page-shell";
import { SupportForm } from "./form";

export const metadata: Metadata = {
  title: "Support",
  description: "Email support@wisedinner.com or use the form on this page for questions, bugs, or a wrong price. We read everything, usually within a day.",
  alternates: { canonical: "/support" },
};

export default function Support() {
  return (
    <PageShell title="Talk to a person" sub="Questions, bugs, a wrong price. We read everything, usually within a day.">
      <p className="text-center text-ink-2">
        Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link text-ink">
          {SUPPORT_EMAIL}
        </a>{" "}
        or use the form. To see or delete your data, say so and we confirm within 7 days.
      </p>
      <div className="mx-auto mt-10 max-w-md">
        <SupportForm />
      </div>
    </PageShell>
  );
}
