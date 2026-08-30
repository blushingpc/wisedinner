import type { SolveOutput } from "@/app/api/solve/solver";
import { CountUp } from "./count-up";

type Props = { week: SolveOutput; variant: "plan" | "drop" | "mini"; title?: string; printedAt?: string; tilt?: boolean };

const Row = ({ l, r, strong }: { l: string; r: string; strong?: boolean }) => (
  <div className="flex items-baseline py-0.5">
    <span className={`uppercase ${strong ? "text-micro" : ""}`}>{l}</span>
    <span className="leader" />
    <span className={strong ? "font-medium" : ""}>{r}</span>
  </div>
);

// receipt-paper + receipt-red live ONLY here. everything inside is mono + tabular.
export function ReceiptCard({ week, variant, title = "your week, solved", printedAt, tilt }: Props) {
  const mini = variant === "mini";
  const list = mini ? week.list.slice(0, 4) : week.list;
  const perishable = week.list.filter((i) => i.perishable);
  const shelf = week.list.filter((i) => !i.perishable);
  return (
    <div className={`w-full bg-receipt-paper px-5 pt-6 pb-5 font-mono text-spec tabular-nums text-ink shadow-receipt ${mini ? "" : "max-w-sm"} ${tilt ? "md:-rotate-[0.5deg]" : ""}`}>
      <p className="text-center text-micro uppercase">wisedinner</p>
      <p className="mt-1 text-center text-ink-soft">{title}</p>
      <p className="my-3 text-center text-ink-soft">* * *</p>

      {!mini && (
        <>
          {week.days.map((d) => (
            <div key={d.day} className="border-b border-dashed border-rule py-2">
              <div className="flex items-baseline justify-between uppercase">
                <span>{d.day}</span>
                <span className="text-ink-soft">
                  {d.protein_g} g · {d.kcal} kcal
                </span>
              </div>
              <p className="mt-0.5 text-ink-soft">{d.items.map((i) => `${i.name}, ${i.portion}`).join(" · ")}</p>
            </div>
          ))}
          <p className="mt-4 text-micro uppercase text-ink-soft">list · fresh aisle</p>
          {perishable.map((i) => (
            <Row key={i.name} l={`${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`} r={i.price_usd === 0 ? "pantry" : `$${i.price_usd.toFixed(2)}`} />
          ))}
          <p className="mt-3 text-micro uppercase text-ink-soft">list · shelf + freezer</p>
          {shelf.map((i) => (
            <Row key={i.name} l={`${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`} r={i.price_usd === 0 ? "pantry" : `$${i.price_usd.toFixed(2)}`} />
          ))}
        </>
      )}
      {mini && list.map((i) => <Row key={i.name} l={`${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`} r={`$${i.price_usd.toFixed(2)}`} />)}

      <div className="my-3 border-t border-dashed border-rule" />
      <div className="flex items-baseline">
        <span className="text-micro uppercase">est. in-store total</span>
        <span className="leader" />
        {mini ? (
          <span className="text-xl font-medium text-receipt-total">${week.est_total.toFixed(2)}</span>
        ) : (
          <CountUp value={week.est_total} prefix="$" className="text-2xl font-medium text-receipt-total" />
        )}
      </div>
      <div className="flex items-baseline py-0.5">
        <span className="text-micro uppercase">protein / day</span>
        <span className="leader" />
        <span className="font-medium text-accent">{week.protein_per_day} g</span>
      </div>
      {!mini && <Row l="kcal / day" r={`${week.kcal_per_day}`} />}
      <Row l="food wasted" r="0" />
      <p className="my-3 text-center text-ink-soft">* * *</p>
      {!mini && <div className="barcode" aria-hidden="true" />}
      <p className="mt-2 text-center text-ink-soft">
        prices as of {week.price_as_of}
        {printedAt ? ` · printed ${printedAt}` : ""}
      </p>
    </div>
  );
}
