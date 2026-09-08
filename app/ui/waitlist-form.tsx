"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "./track";

type State = "idle" | "loading" | "error" | "already";

// one form, five entry points (source). success → /thanks?n=position. quiz answers ride along from /plan.
// dark: the forest-900 pre-order band (REDESIGN-V3 §4) — paper text, paper field, forest button; errors go forest there (danger fails AA on forest).
// placement: set when the form is the page's primary control (listing not live) so the data-placement contract (WD-01) survives.
export function WaitlistForm({ source, quiz, dark, label = "email", button = "notify me", placement }: { source: string; quiz?: unknown; dark?: boolean; label?: string; button?: string; placement?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  const id = `email-${source}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source, quiz }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.status === "already") {
        track("waitlist_duplicate", { source });
        setState("already");
        return;
      }
      track("waitlist_join", { source });
      router.push(`/thanks?n=${data.position}`);
    } catch {
      setState("error");
    }
  };

  const soft = dark ? "text-white/80" : "text-ink-2";
  return (
    <form onSubmit={submit} className="w-full max-w-md" aria-describedby={`${id}-msg`}>
      <label htmlFor={id} className={`block text-caption font-semibold ${soft}`}>
        {label}
      </label>
      {/* ≤420: field over a full-width 54px button (the field's natural height at 18px) — a 90vw tap target is the one thing every download page does (#14, reference study rank 2); wider: one row */}
      <div className="mt-2 flex flex-col gap-2 min-[421px]:flex-row">
        <input
          id={id}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`field ${dark ? "border-transparent" : ""}`}
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={state === "loading"} data-placement={placement} className="cta cta-wide">
          {state === "loading" ? "saving…" : button}
        </button>
      </div>
      <p id={`${id}-msg`} role="status" aria-live="polite" className={`mt-3 min-h-6 text-sm ${state === "error" ? `${dark ? "text-white" : "text-danger"}` : soft}`}>
        {state === "already" && "you're already on the list — good instincts."}
        {state === "error" && "that didn't go through. try once more?"}
        {state === "idle" && "no spam. one email when the app is ready."}
      </p>
    </form>
  );
}
