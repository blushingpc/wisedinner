import Image from "next/image";
import { site } from "@/content/site";

// people section — proof row, quotes and founder note render ONLY from real content values.
// counts need >= 100; empty quotes/founder note hide their blocks; all empty → section gone.
export function People() {
  const { proof, quotes, founderNote } = site;
  const stats = [
    proof.preorders >= 100 && { n: proof.preorders.toLocaleString("en-US"), cap: "pre-orders" },
    proof.demoWeeksThisMonth >= 100 && { n: proof.demoWeeksThisMonth.toLocaleString("en-US"), cap: "demo weeks solved" },
    proof.avgWeekUsd > 0 && (proof.preorders >= 100 || proof.demoWeeksThisMonth >= 100) && { n: `$${proof.avgWeekUsd.toFixed(2)}`, cap: "avg. week" },
  ].filter(Boolean) as { n: string; cap: string }[];
  const hasFounder = founderNote.text !== "";

  if (stats.length === 0 && quotes.length === 0 && !hasFounder) return null;

  return (
    <section className="py-14 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-x-16 gap-y-8">
            {stats.map((s) => (
              <div key={s.cap}>
                <p className="text-[clamp(32px,4vw,44px)] font-extrabold leading-none tabular-nums">{s.n}</p>
                <p className="mt-2 text-caption text-ink-soft">{s.cap}</p>
              </div>
            ))}
          </div>
        )}
        {hasFounder && (
          <div className={`grid items-center gap-10 sm:grid-cols-[2fr_3fr] ${stats.length > 0 ? "mt-14" : ""}`}>
            {founderNote.photo && (
              <Image
                src={founderNote.photo}
                alt={`${founderNote.name} in their kitchen`}
                width={800}
                height={1000}
                quality={75}
                sizes="(min-width: 640px) 40vw, 100vw"
                className="img-grade aspect-[4/5] w-full rounded-[14px] object-cover"
              />
            )}
            <div>
              <p className="text-[1.25rem] font-medium leading-relaxed">{founderNote.text}</p>
              <p className="mt-4 text-caption text-ink-soft">— {founderNote.name}</p>
            </div>
          </div>
        )}
        {quotes.length > 0 && (
          <div className={`grid gap-10 sm:grid-cols-3 sm:gap-6 ${stats.length > 0 || hasFounder ? "mt-14" : ""}`}>
            {quotes.slice(0, 3).map((q, i) => (
              <figure key={q.name} className={i === 1 ? "sm:mt-6" : undefined}>
                <blockquote className="text-[clamp(18px,1.8vw,22px)] font-semibold leading-snug text-balance">“{q.text}”</blockquote>
                <figcaption className="mt-3 text-caption text-ink-soft">
                  {q.name} · {q.city} · {q.date}
                  {q.tag && <span className="ml-2 rounded-full bg-bg-alt px-2 py-0.5 text-[0.75rem]">{q.tag}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
