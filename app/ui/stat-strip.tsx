// stacked or row of big mono numbers with micro labels. values are strings so the caller formats + labels honestly.
export function StatStrip({ stats, stacked }: { stats: [string, string][]; stacked?: boolean }) {
  return (
    <dl className={stacked ? "grid gap-2" : "grid gap-6 sm:grid-cols-3"}>
      {stats.map(([value, label], i) => (
        <div key={label} data-reveal style={{ "--i": i } as React.CSSProperties} className="border-t border-rule py-4">
          <dd className="font-mono text-4xl font-medium tabular-nums sm:text-5xl">{value}</dd>
          <dt className="mt-1 font-mono text-micro uppercase text-ink-soft">{label}</dt>
        </div>
      ))}
    </dl>
  );
}
