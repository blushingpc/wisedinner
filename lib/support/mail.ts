import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

// Gmail over IMAP (read unseen) and SMTP (send) with an app password. the poll route injects these so tests can
// swap them for fixtures.
export type Inbound = { uid: number; messageId: string; inReplyTo?: string; from: string; subject: string; text: string; date: string };
export type Outbound = { to: string; subject: string; text: string; inReplyTo?: string; references?: string[] };

export type Mailbox = {
  unread(): Promise<Inbound[]>;
  markSeen(uid: number): Promise<void>;
  send(mail: Outbound): Promise<{ messageId: string }>;
};

const addr = () => process.env.SUPPORT_GMAIL_ADDRESS ?? "";
const pass = () => process.env.SUPPORT_GMAIL_APP_PASSWORD ?? "";
export const mailConfigured = () => Boolean(addr() && pass());

export function gmail(): Mailbox {
  const client = () => new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: addr(), pass: pass() }, logger: false });
  return {
    async unread() {
      const c = client();
      await c.connect();
      const out: Inbound[] = [];
      try {
        const lock = await c.getMailboxLock("INBOX");
        try {
          for await (const msg of c.fetch({ seen: false }, { uid: true, source: true })) {
            if (!msg.source) continue;
            const parsed = await simpleParser(msg.source);
            const fromAddr = parsed.from?.value?.[0]?.address ?? "";
            if (!fromAddr) continue;
            out.push({
              uid: msg.uid,
              messageId: parsed.messageId ?? `<${msg.uid}@${addr()}>`,
              inReplyTo: parsed.inReplyTo ?? undefined,
              from: fromAddr.toLowerCase(),
              subject: parsed.subject ?? "",
              text: (parsed.text ?? "").trim(),
              date: (parsed.date ?? new Date()).toISOString(),
            });
          }
        } finally {
          lock.release();
        }
      } finally {
        await c.logout();
      }
      return out;
    },
    async markSeen(uid) {
      const c = client();
      await c.connect();
      try {
        const lock = await c.getMailboxLock("INBOX");
        try {
          await c.messageFlagsAdd({ uid: String(uid) }, ["\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
      } finally {
        await c.logout();
      }
    },
    async send(mail) {
      const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: addr(), pass: pass() } });
      const info = await t.sendMail({
        from: `WiseDinner support <${addr()}>`,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        inReplyTo: mail.inReplyTo,
        references: mail.references,
      });
      return { messageId: info.messageId };
    },
  };
}
