import type { SolveOutput } from "@/lib/solver";
import { site } from "@/content/site";
import { CountUp } from "./count-up";

type Props = { week: SolveOutput; variant: "plan" | "drop" | "mini" | "proof"; title?: string; printedAt?: string; tilt?: boolean };

const Row = ({ l, r, strong }: { l: string; r: string; strong?: boolean }) => (
  <div className="flex items-baseline py-0.5">
    <span className={`uppercase ${strong ? "text-xs" : ""}`}>{l}</span>
    <span className="leader" />
    <span className={strong ? "font-medium" : ""}>{r}</span>
  </div>
);

// surface + receipt-red live ONLY here. everything inside is mono + tabular.
// "proof" = the one homepage receipt (DESIGN-AUDIT §9.7): 12 lines + totals, no day rows, no kcal, no date stamp.
export function ReceiptCard({ week, variant, title = "your week, solved", printedAt, tilt }: Props) {
  const mini = variant === "mini";
  const proof = variant === "proof";
  const list = mini ? week.list.slice(0, 4) : week.list;
  const perishable = week.list.filter((i) => i.perishable);
  const shelf = week.list.filter((i) => !i.perishable);
  return (
    <div className={`w-full bg-surface px-5 pt-6 pb-5 tnum text-sm tabular-nums text-ink shadow-card ${mini ? "" : "max-w-sm"} ${tilt ? "md:-rotate-[0.5deg]" : ""}`}>
      <p className="text-center text-xs uppercase">wisedinner</p>
      <p className="mt-1 text-center text-ink-2">{title}</p>
      <p className="my-3 text-center text-ink-2">* * *</p>

      {/* day rows only on /drop, where the receipt is the sole day listing; /plan shows days as cards beside it (§9.13) */}
      {variant === "drop" &&
        week.days.map((d) => (
          <div key={d.day} className="border-b border-dashed border-border py-2">
            <div className="flex items-baseline justify-between uppercase">
              <span>{d.day}</span>
              <span className="text-ink-2">
                {d.protein_g} g · {d.kcal} kcal
              </span>
            </div>
            <p className="mt-0.5 text-ink-2">{d.items.map((i) => i.name).join(" · ")}</p>
          </div>
        ))}
      {!mini && (
        <>
          <p className="mt-4 text-xs uppercase text-ink-2">list · fresh aisle</p>
          {perishable.map((i) => (
            <Row key={i.name} l={`${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`} r={i.price_usd === 0 ? "pantry" : `$${i.price_usd.toFixed(2)}`} />
          ))}
          <p className="mt-3 text-xs uppercase text-ink-2">list · shelf + freezer</p>
          {shelf.map((i) => (
            <Row key={i.name} l={`${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`} r={i.price_usd === 0 ? "pantry" : `$${i.price_usd.toFixed(2)}`} />
          ))}
        </>
      )}
      {mini && list.map((i) => <Row key={i.name} l={`${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`} r={`$${i.price_usd.toFixed(2)}`} />)}

      <div className="my-3 border-t border-dashed border-border" />
      <div className="flex items-baseline">
        <span className="text-xs uppercase">est. in-store total</span>
        <span className="leader" />
        {mini || proof ? (
          <span className={`${proof ? "text-2xl" : "text-xl"} font-medium text-danger`}>${week.est_total.toFixed(2)}</span>
        ) : (
          <CountUp value={week.est_total} prefix="$" className="text-2xl font-medium text-danger" />
        )}
      </div>
      <div className="flex items-baseline py-0.5">
        <span className="text-xs uppercase">protein / day</span>
        <span className="leader" />
        <span className="font-medium text-forest">{week.protein_per_day} g</span>
      </div>
      {variant === "drop" && <Row l="kcal / day" r={`${week.kcal_per_day}`} />}
      <Row l="food wasted" r="0" />
      <p className="my-3 text-center text-ink-2">* * *</p>
      {proof && <p className="mb-2 text-center text-[0.75rem] text-ink-2">{site.receipt.refreshed}</p>}
      {!mini && <div className="barcode" aria-hidden="true" />}
      {!proof && (
        <p className="mt-2 text-center text-ink-2">
          prices as of {week.price_as_of}
          {printedAt ? ` · printed ${printedAt}` : ""}
        </p>
      )}
    </div>
  );
}
