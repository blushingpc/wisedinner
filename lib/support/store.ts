import { insert, select, upsert } from "@/app/api/db";
import type { Store, Thread } from "./handler.ts";

// support_threads / support_messages_v2 through the PostgREST helper (service key only)
export function dbStore(): Store {
  return {
    async findThread(inReplyTo, from, subject) {
      if (inReplyTo) {
        const byMsg = await select<{ thread_id: string }>("support_messages_v2", `select=thread_id&message_id=eq.${encodeURIComponent(inReplyTo)}&limit=1`);
        if (byMsg[0]) {
          const t = await select<Thread>("support_threads", `select=id,from_email,subject,status,message_id&id=eq.${byMsg[0].thread_id}`);
          if (t[0]) return t[0];
        }
      }
      const rows = await select<Thread>("support_threads", `select=id,from_email,subject,status,message_id&from_email=eq.${encodeURIComponent(from)}&subject=eq.${encodeURIComponent(subject)}&order=created_at.desc&limit=1`);
      return rows[0] ?? null;
    },
    async createThread(t) {
      const id = crypto.randomUUID();
      const res = await insert("support_threads", { id, ...t, status: "open" });
      if (!res.ok) throw new Error(`support_threads insert ${res.status}: ${res.body}`);
      return { id, from_email: t.from_email, subject: t.subject, status: "open", message_id: t.message_id };
    },
    async logMessage(m) {
      const res = await insert("support_messages_v2", m);
      if (!res.ok && !res.duplicate) throw new Error(`support_messages_v2 insert ${res.status}: ${res.body}`);
    },
    async setStatus(threadId, status) {
      await upsert("support_threads", [{ id: threadId, status, updated_at: new Date().toISOString() }], "id");
    },
    async sentLast24h() {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const rows = await select<{ id: string }>("support_messages_v2", `select=id&direction=eq.out&created_at=gte.${since}`);
      return rows.length;
    },
    async hasMessage(messageId) {
      const rows = await select<{ id: string }>("support_messages_v2", `select=id&message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
      return rows.length > 0;
    },
  };
}
