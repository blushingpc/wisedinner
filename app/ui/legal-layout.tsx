import { SUPPORT_EMAIL } from "@/app/copy";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

// LEGAL LAYOUT (REDESIGN-V4 §10.18b): centered H1 and the effective date, then a sticky contents column beside the
// 60ch prose on desktop. Sections are plain data so each page is just content.
export function LegalLayout({ title, effective, sections }: { title: string; effective: string; sections: LegalSection[] }) {
  return (
    <main id="main">
      <section className="bg-white py-band">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
          <div className="mx-auto max-w-[40ch] text-center">
            <h1 className="text-h1 text-balance">{title}</h1>
            <p className="mt-4 text-sm text-ink-2 tnum">Effective {effective}</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-[960px] gap-12 lg:mt-16 lg:grid-cols-[220px_1fr]">
            <nav aria-label="On this page" className="hidden self-start lg:sticky lg:top-24 lg:block">
              <p className="text-sm font-semibold">Contents</p>
              <ol className="mt-2 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink hover:underline">
                      <span className="mr-2 tnum">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <article className="prose">
              {sections.map((s, i) => (
                <section key={s.id}>
                  <h2 id={s.id} className="first:mt-0">
                    {i + 1}. {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}
              <p className="mt-12 text-sm">
                Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
