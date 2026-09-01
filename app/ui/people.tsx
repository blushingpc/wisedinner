import { proof, quotes } from "@/content/site";

// people section — proof row + staggered quotes, no tiles, no stars, no avatars.
// every element hides itself when its content/site.ts value is 0 / empty; section gone when all are.
export function People() {
  const stats = [
    proof.preorders > 0 && { n: proof.preorders.toLocaleString("en-US"), cap: "pre-orders" },
    proof.demoWeeksThisMonth > 0 && { n: proof.demoWeeksThisMonth.toLocaleString("en-US"), cap: "demo weeks solved" },
    proof.avgWeekUsd > 0 && { n: `$${proof.avgWeekUsd.toFixed(2)}`, cap: "avg. week" },
  ].filter(Boolean) as { n: string; cap: string }[];

  if (stats.length === 0 && quotes.length === 0) return null;

  return (
    <section className="py-14 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        {stats.length > 0 && (
          <div data-truth="placeholder" className="flex flex-wrap gap-x-16 gap-y-8">
            {stats.map((s) => (
              <div key={s.cap}>
                <p className="text-[clamp(32px,4vw,44px)] font-extrabold leading-none tabular-nums">{s.n}</p>
                <p className="mt-2 text-caption text-ink-soft">{s.cap}</p>
              </div>
            ))}
          </div>
        )}
        {quotes.length > 0 && (
          <div className={`grid gap-10 sm:grid-cols-3 sm:gap-6 ${stats.length > 0 ? "mt-14" : ""}`}>
            {quotes.slice(0, 3).map((q, i) => (
              <figure key={q.name} data-truth="placeholder" className={i === 1 ? "sm:mt-6" : undefined}>
                <blockquote className="text-[clamp(18px,1.8vw,22px)] font-semibold leading-snug text-balance">“{q.text}”</blockquote>
                <figcaption className="mt-3 text-caption text-ink-soft">
                  {q.name} · {q.city} · {q.date}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
