import { SUPPORT_EMAIL } from "@/app/copy";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

// prose 65ch, h2 anchors, desktop toc, effective date. sections are plain data so each page is just content.
export function LegalLayout({ title, effective, sections }: { title: string; effective: string; sections: LegalSection[] }) {
  return (
    <main id="main" className="mx-auto grid max-w-[1200px] gap-12 px-6 py-14 lg:grid-cols-[220px_1fr] lg:px-12 lg:py-24">
      <nav aria-label="on this page" className="hidden self-start lg:sticky lg:top-24 lg:block">
        <p className="font-mono text-micro uppercase text-ink-soft">contents</p>
        <ol className="mt-3 space-y-1 text-spec">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-8 items-center hover:underline">
                <span className="mr-2 font-mono text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article className="prose">
        <h1 className="text-display font-bold">{title}</h1>
        <p className="mt-3 font-mono text-micro uppercase text-ink-soft">effective: {effective}</p>
        {sections.map((s, i) => (
          <section key={s.id}>
            <h2 id={s.id}>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}
        <p className="mt-12 font-mono text-spec">
          questions:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </article>
    </main>
  );
}
