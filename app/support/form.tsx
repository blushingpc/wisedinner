"use client";

import { useState } from "react";
import { track } from "@/app/ui/track";

const label = "block font-mono text-micro uppercase text-ink-soft";

export function SupportForm() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: f.get("name"), email: f.get("email"), message: f.get("message"), website: f.get("website") }),
      });
      if (!res.ok) throw new Error(String(res.status));
      track("support_submit");
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p role="status" className="text-xl">
        got it — we read everything, usually within a day.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div>
        <label htmlFor="s-name" className={label}>
          name (optional)
        </label>
        <input id="s-name" name="name" maxLength={120} autoComplete="name" className="field mt-2" />
      </div>
      <div>
        <label htmlFor="s-email" className={label}>
          email
        </label>
        <input id="s-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@email.com" className="field mt-2" />
      </div>
      <div>
        <label htmlFor="s-msg" className={label}>
          message
        </label>
        <textarea id="s-msg" name="message" required minLength={2} maxLength={2000} rows={6} className="field mt-2" />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state === "error" && (
        <p role="alert" className="font-mono text-spec text-receipt-total">
          that didn&apos;t go through. try once more?
        </p>
      )}
      <button type="submit" disabled={state === "loading"} className="cta justify-self-start">
        {state === "loading" ? "sending…" : "send"}
      </button>
    </form>
  );
}
