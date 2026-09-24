import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt } from "./kb.ts";

// one call: Claude reads the inbound email against the knowledge base and either drafts the reply or escalates.
// JSON structured output (output_config.format) returns schema-shaped JSON; parseTriage() still checks it, because
// anything other than a clean, confident informational verdict must escalate.
export type Triage = { intent: "informational" | "escalate"; category: string; reason: string; reply: string };

// the cheapest current Haiku-tier model (founder decision 2026-09-12): triage is one structured call over a 6 KB body
// and does not need Opus; the voice send gate in handler.ts escalates any draft that fails the copy rules
export const MODEL = "claude-haiku-4-5-20251001";

// reply before reason, and reason always filled. on Haiku 4.5, forced strict tool use leaked parameter markup into the
// fields whenever a string parameter was empty (10 of 10 test calls, 2026-09-12); JSON output with this schema, 0 of 10.
export const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "category", "reply", "reason"],
  properties: {
    intent: { type: "string", enum: ["informational", "escalate"] },
    category: { type: "string", description: "short label: pricing | how-it-works | timing | free-tier | privacy | refund | legal | data-deletion | press | bug | other" },
    reply: { type: "string", description: "the full reply body when informational; an empty string when escalating" },
    reason: { type: "string", description: "one short line, always filled: when informational, what was answered; when escalating, why a person is needed" },
  },
};

const MARKUP = /<\/?antml|<\/?parameter|<\/?invoke|antml:/i;
const escalate = (reason: string): Triage => ({ intent: "escalate", category: "other", reason, reply: "" });
// categories the knowledge base always escalates (kb.ts: refunds, legal, data deletion, press, bugs); an
// "informational" verdict on one of them contradicts itself, so it is not a confident verdict
const PERSON_ONLY = new Set(["refund", "legal", "data-deletion", "press", "bug"]);

// the model's text → a Triage. anything malformed escalates; an escalation never carries a reply.
export function parseTriage(text: string): Triage {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return escalate("malformed triage: not JSON");
  }
  const t = raw as Partial<Triage> | null;
  if (!t || typeof t !== "object" || (t.intent !== "informational" && t.intent !== "escalate") || [t.category, t.reason, t.reply].some((v) => typeof v !== "string")) {
    return escalate("malformed triage: wrong shape");
  }
  const ok = t as Triage;
  if ([ok.category, ok.reason, ok.reply].some((v) => MARKUP.test(v))) return escalate("malformed triage: markup in a field");
  if (ok.intent === "escalate") return { ...ok, reply: "" };
  if (PERSON_ONLY.has(ok.category.trim().toLowerCase())) return { ...ok, intent: "escalate", reason: `informational verdict on a ${ok.category} email`, reply: "" };
  if (!ok.reply.trim()) return { ...ok, intent: "escalate", reason: "empty reply" };
  return ok;
}

export type Classifier = (email: { from: string; subject: string; body: string }) => Promise<Triage>;

export const classifyWithClaude: Classifier = async (email) => {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    // no thinking / effort params: Haiku 4.5 rejects adaptive thinking and output_config.effort with a 400
    output_config: { format: { type: "json_schema", schema: TRIAGE_SCHEMA } },
    messages: [{ role: "user", content: `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body.slice(0, 6000)}` }],
  });
  if (res.stop_reason === "refusal") return escalate("the assistant declined to answer");
  if (res.stop_reason === "max_tokens") return escalate("malformed triage: cut off");
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return escalate("no triage result");
  return parseTriage(text);
};
