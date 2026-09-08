"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { site } from "@/content/site";
import { track } from "./track";

type State = "idle" | "loading" | "error" | "already";

// one form, several entry points (source). success → /thanks?n=position.
// dark: the forest pre-order band; white text, white field, white button with forest text.
// placement: set when the form is the page's primary control so the data-placement contract survives.
export function WaitlistForm({ source, quiz, dark, label = "Email", button = site.hero.cta, placement, micro = site.hero.micro }: { source: string; quiz?: unknown; dark?: boolean; label?: string; button?: string; placement?: string; micro?: string }) {
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
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/* ≤420: field over a full-width 54px button; wider: one row */}
      <div className="flex flex-col gap-2 min-[421px]:flex-row">
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
        <button type="submit" disabled={state === "loading"} data-placement={placement} className={`cta cta-wide ${dark ? "cta-light" : ""}`}>
          {state === "loading" ? "Saving" : button}
        </button>
      </div>
      <p id={`${id}-msg`} role="status" aria-live="polite" className={`mt-3 min-h-6 text-sm ${state === "error" ? (dark ? "text-white" : "text-danger") : soft}`}>
        {state === "already" && "You are already on the list. Good instincts."}
        {state === "error" && "That did not go through. Try once more."}
        {state === "idle" && micro}
      </p>
    </form>
  );
}
