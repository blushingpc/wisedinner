import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt } from "./kb.ts";

// one call: Claude reads the inbound email against the knowledge base and either drafts the reply or escalates.
// forced strict tool use gives a schema-valid answer every time (no prose parsing).
export type Triage = { intent: "informational" | "escalate"; category: string; reason: string; reply: string };

export const MODEL = "claude-opus-5";

const TRIAGE_TOOL: Anthropic.Tool = {
  name: "triage",
  description: "Classify the support email and, for informational intents, draft the reply.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent", "category", "reason", "reply"],
    properties: {
      intent: { type: "string", enum: ["informational", "escalate"] },
      category: { type: "string", description: "short label: pricing | how-it-works | timing | free-tier | privacy | refund | legal | data-deletion | press | bug | other" },
      reason: { type: "string", description: "one line for the person reading the escalation digest (empty when informational)" },
      reply: { type: "string", description: "the reply body when informational (empty when escalating)" },
    },
  },
};

export type Classifier = (email: { from: string; subject: string; body: string }) => Promise<Triage>;

export const classifyWithClaude: Classifier = async (email) => {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    tools: [TRIAGE_TOOL],
    tool_choice: { type: "tool", name: "triage" },
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    messages: [{ role: "user", content: `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body.slice(0, 6000)}` }],
  });
  if (res.stop_reason === "refusal") return { intent: "escalate", category: "other", reason: "the assistant declined to answer", reply: "" };
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!use) return { intent: "escalate", category: "other", reason: "no triage result", reply: "" };
  const t = use.input as Triage;
  if (t.intent === "informational" && !t.reply.trim()) return { ...t, intent: "escalate", reason: "empty reply" };
  return t;
};
