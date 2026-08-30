import { solve } from "@/app/api/solve/solver";
import { staples } from "@/data/staples";

// the example week on the landing page is real solver output, not marketing copy
const EXAMPLE = { budget: 100, protein_per_day: 150, kcal_min: 1800, kcal_max: 2800, diet: "none", household: 1 } as const;

export default function Home() {
  const week = solve(EXAMPLE, staples);
  const [dollars, cents] = week.est_total.toFixed(2).split(".");
  const weekProtein = week.days.reduce((a, d) => a + d.protein_g, 0);
  const proteinPerDollar = Math.round(weekProtein / week.est_total);
  const printedAt = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).toLowerCase();

  return (
    <>
      <header className="sticky top-0 z-(--z-sticky) border-b border-rule bg-bg/96">
        <div className="mx-auto flex max-w-[1200px] items-baseline justify-between px-6 py-4 lg:px-12">
          <span className="text-lg font-bold tracking-tight">wisedinner</span>
          <span className="font-mono text-micro uppercase text-ink-soft">status: shell · solver v0</span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1200px] px-6 lg:px-12">
        {/* hero — py-28 */}
        <section className="grid min-h-[88dvh] items-center gap-12 border-b border-rule py-16 sm:py-28 md:grid-cols-[1.6fr_1fr]">
          <div className="max-w-[62ch]">
            <p className="font-mono text-micro uppercase text-ink-soft">groceries, solved like math</p>
            <h1 className="mt-6 text-display font-bold text-balance">
              150g of protein a <span className="font-normal">day.</span>
            </h1>
            <p className="mt-10 font-mono text-hero font-medium tabular-nums">
              ${dollars}
              <span className="text-[0.5em] text-ink-soft">.{cents}</span>
            </p>
            <p className="mt-2 font-mono text-micro uppercase text-ink-soft">
              est. in-store · example week, one person, {EXAMPLE.protein_per_day} g/day · prices as of {week.price_as_of}
            </p>
            <p className="mt-8 text-ink-soft">your week, estimated in-store. before you shop.</p>
          </div>

          {/* receipt artifact — the only card; tilt is imperfection move #1 */}
          <div
            data-reveal
            className="w-full max-w-xs justify-self-start bg-receipt-paper px-6 pt-7 pb-6 font-mono text-spec tabular-nums shadow-receipt md:-rotate-[0.5deg] md:justify-self-end"
          >
            <p className="text-center text-micro uppercase">wisedinner</p>
            <p className="mt-1 text-center text-ink-soft">one week, solved</p>
            <p className="my-4 text-center text-ink-soft">* * *</p>
            {week.list.map((item) => (
              <div key={item.name} className="flex items-baseline py-0.5">
                <span className="uppercase">
                  {item.qty > 1 ? `${item.qty}× ` : ""}
                  {item.name}
                </span>
                <span className="leader" />
                <span>${item.price_usd.toFixed(2)}</span>
              </div>
            ))}
            <div className="my-4 border-t border-dashed border-rule" />
            <div className="flex items-baseline">
              <span className="text-micro uppercase">est. in-store</span>
              <span className="leader" />
              <span className="text-xl font-medium text-receipt-total">${week.est_total.toFixed(2)}</span>
            </div>
            <div className="flex items-baseline py-0.5">
              <span className="uppercase">protein / day</span>
              <span className="leader" />
              <span>{week.protein_per_day} g</span>
            </div>
            <div className="flex items-baseline py-0.5">
              <span className="uppercase">food wasted</span>
              <span className="leader" />
              <span>0</span>
            </div>
            <p className="my-4 text-center text-ink-soft">* * *</p>
            <div className="barcode" aria-hidden="true" />
            <p className="mt-2 text-center text-ink-soft">printed {printedAt}</p>
          </div>
        </section>

        {/* the math strip — py-20 */}
        <section className="grid border-b border-rule py-12 sm:py-20 md:grid-cols-[1.6fr_1fr_1fr]">
          {[
            ["protein / dollar", `${proteinPerDollar} g`],
            ["items / week", `${week.list.length}`],
            ["waste friday", "0"],
          ].map(([label, value], i) => (
            <div key={label} data-reveal style={{ "--i": i } as React.CSSProperties} className="border-t border-rule py-6 md:border-t-0 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-0">
              <p className="font-mono text-5xl font-medium tabular-nums sm:text-6xl">{value}</p>
              <p className="mt-2 font-mono text-micro uppercase text-ink-soft">{label}</p>
            </div>
          ))}
        </section>

        {/* how it works — py-36 */}
        <section className="py-20 sm:py-36">
          <h2 className="text-h2 font-bold">how it works</h2>
          <ol className="mt-10 max-w-[62ch]">
            {["tell us your numbers", "we solve the week", "shop it, cook it, keep the receipt"].map((step, i) => (
              <li key={step} data-reveal style={{ "--i": i } as React.CSSProperties} className="flex items-baseline gap-6 border-t border-rule py-5">
                <span className="font-mono text-micro text-ink-soft">0{i + 1}</span>
                <span className="text-xl">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-[62ch] text-ink-soft">
            the solver runs on a fixed staple pool with dated, buffered shelf prices. delivered prices, if we ever show
            them, sit next to the in-store number with fees included.
          </p>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-baseline justify-between gap-4 px-6 py-8 lg:px-12">
          <span className="font-bold">wisedinner</span>
          <span className="font-mono text-micro text-ink-soft">built by two people and a solver · last deploy {printedAt}</span>
        </div>
      </footer>
    </>
  );
}
