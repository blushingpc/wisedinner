import { track as vercel } from "@vercel/analytics";

export type Event =
  | "demo_start"
  | "demo_complete"
  | "reveal_view"
  | "waitlist_join"
  | "waitlist_duplicate"
  | "drop_view"
  | "support_submit"
  | "pricing_view";

// fire-and-forget; analytics blocked → nothing happens, site unaffected
export function track(event: Event, props?: Record<string, string | number>) {
  try {
    vercel(event, props);
  } catch {}
}
