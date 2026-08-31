"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "./track";

type State = "idle" | "loading" | "error" | "already";

// one form, five entry points (source). success → /thanks?n=position. quiz answers ride along from /plan.
export function WaitlistForm({ source, quiz, light }: { source: string; quiz?: unknown; light?: boolean }) {
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

  const soft = light ? "text-bg/80" : "text-ink-soft";
  return (
    <form onSubmit={submit} className="w-full max-w-md" aria-describedby={`${id}-msg`}>
      <label htmlFor={id} className={`block text-caption font-semibold ${soft}`}>
        email
      </label>
      <div className="mt-2 flex gap-2">
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
          className={`field ${light ? "border-bg/30 bg-transparent text-bg placeholder:text-bg/70" : ""}`}
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={state === "loading"} className={`cta ${light ? "cta-light" : ""}`}>
          {state === "loading" ? "saving…" : "get early access"}
        </button>
      </div>
      <p id={`${id}-msg`} role="status" aria-live="polite" className={`mt-3 min-h-6 text-spec ${state === "error" ? "font-mono text-receipt-total" : soft}`}>
        {state === "already" && "you're already on the list — good instincts."}
        {state === "error" && "that didn't go through. try once more?"}
        {state === "idle" && "no spam. one email when the app is ready."}
      </p>
    </form>
  );
}
