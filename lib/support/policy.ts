// the two promises the assistant must never make (founder, 2026-09-26), checked on every draft before it is sent; a
// draft that breaks one escalates to a person like a voice-fail. the prompt (content/support-kb.ts) says the same
// thing, this is the check that does not depend on the model listening.
// 1. no refund promises: Apple handles refunds, so any reply that mentions a refund points to reportaproblem.apple.com
//    and never says we, or anyone, will refund.
// 2. Courier is never available now: it arrives in an update after release, so any reply that names Courier says so
//    and never offers it now or today, or gives it a time frame (it has no date).
const REFUND = /\brefund/i;
const REFUND_PROMISE: RegExp[] = [
  /\b(?:we|i)(?:'ll| will| can| could| would| are going to| are happy to| would be happy to)\b[^.\n]{0,40}\brefund/i,
  /\byou(?:'ll| will) (?:get|receive|be given) (?:a |your )?(?:full )?refund/i,
  /\brefunds? (?:is|are|has been|have been|will be) (?:guaranteed|approved|issued|on (?:its|the) way)/i,
  /\bguarantee[sd]?\b[^.\n]{0,30}\brefund|\brefund[^.\n]{0,30}\bguarantee/i,
];
const APPLE_REFUND_URL = "reportaproblem.apple.com";
const COURIER = /\bCourier\b/;
const COURIER_NOW: RegExp[] = [
  /\bCourier\b[^.\n]{0,60}\b(?:available|out|live|in the app|on sale|for sale)\b[^.\n]{0,15}\b(?:now|today|already)\b/i,
  /\b(?:buy|get|subscribe to|purchase|start|upgrade to|try)\b[^.\n]{0,25}\bCourier\b[^.\n]{0,40}\b(?:now|today|right away)\b/i,
  /\bCourier is (?:available|out|live)\b/i,
];
// Courier has no date: a time span in the same sentence as Courier is an invented timeline
const COURIER_WHEN = /\bCourier\b[^.\n]{0,80}\b(?:\d+|a few|a couple of|several|one|two|three|four|six)\s+(?:days?|weeks?|months?)\b|\b(?:days?|weeks?|months?)\b[^.\n]{0,40}\bCourier\b/i;
const negated = (s: string) => /\bnot\b|n't\b|\bnever\b|\byet\b/i.test(s);
const snippet = (text: string, at: number) => text.slice(Math.max(0, at - 30), at + 50).replace(/\s+/g, " ").trim();

export function policyProblems(text: string): string[] {
  const out: string[] = [];
  if (REFUND.test(text)) {
    for (const re of REFUND_PROMISE) {
      const m = re.exec(text);
      if (m && !negated(m[0])) out.push(`refund promise in "${snippet(text, m.index)}"`);
    }
    if (!text.toLowerCase().includes(APPLE_REFUND_URL)) out.push(`mentions a refund without pointing to ${APPLE_REFUND_URL}`);
  }
  if (COURIER.test(text)) {
    for (const re of COURIER_NOW) {
      const m = re.exec(text);
      if (m && !negated(m[0])) out.push(`says Courier is available now in "${snippet(text, m.index)}"`);
    }
    const when = COURIER_WHEN.exec(text);
    if (when) out.push(`gives Courier a time frame in "${snippet(text, when.index)}"`);
    if (!/after release/i.test(text)) out.push(`names Courier without saying it arrives after release`);
  }
  return out;
}
