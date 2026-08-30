export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-14">
      <header className="flex items-baseline justify-between">
        <span className="text-lg font-medium tracking-tight">wisedinner</span>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
          status: shell
        </span>
      </header>

      <section className="mt-24 sm:mt-36">
        <h1 className="max-w-lg text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          your budget in. your protein hit. one solved week out.
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
          give us a weekly number and a protein target. we hand back one small
          grocery list, five days of meals, nothing thrown out. the receipt is
          the proof.
        </p>
      </section>

      <section className="mt-20 sm:mt-28">
        <div className="relative w-full max-w-xs rotate-[0.4deg] bg-receipt shadow-receipt">
          <div className="px-6 pt-7 pb-6 font-mono text-sm tabular-nums">
            <p className="text-center text-xs uppercase tracking-[0.2em]">
              wisedinner
            </p>
            <p className="mt-1 text-center text-xs text-ink-soft">
              one week, solved
            </p>
            <p className="my-4 text-center text-ink-soft">* * *</p>

            <Row label="weekly budget" value="your number" />
            <Row label="protein / day" value="your target" />
            <Row label="days planned" value="5" />
            <Row label="grocery trips" value="1" />
            <Row label="food wasted" value="0" tone="accent" />

            <p className="my-4 text-center text-ink-soft">* * *</p>

            <div className="flex items-baseline">
              <span className="text-xs uppercase tracking-[0.14em]">
                est. in-store
              </span>
              <span className="mx-2 mb-1 flex-1 border-b-2 border-dotted border-rule" />
              <span className="text-xl font-medium text-stamp">solved</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              shelf prices, dated + buffered. not a guarantee.
            </p>

            <div className="barcode mt-6" aria-hidden="true" />
            <p className="mt-2 text-center text-xs text-ink-soft">
              thank you for counting
            </p>
          </div>
          <div className="receipt-edge absolute inset-x-0 -bottom-[10px]" aria-hidden="true" />
        </div>

        <p className="mt-10 max-w-md text-base leading-relaxed text-ink-soft">
          when the solver ships, it will run on a fixed staple pool with dated
          prices. delivered prices, if we show them, will sit next to the
          in-store number, fees included.
        </p>
      </section>

      <footer className="mt-32 border-t border-rule pt-4 font-mono text-xs text-ink-soft">
        wisedinner · the receipt is the brand
      </footer>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent";
}) {
  return (
    <div className="flex items-baseline py-0.5">
      <span className="uppercase tracking-[0.08em]">{label}</span>
      <span className="mx-2 mb-1 flex-1 border-b-2 border-dotted border-rule" />
      <span className={tone === "accent" ? "text-accent" : undefined}>{value}</span>
    </div>
  );
}
