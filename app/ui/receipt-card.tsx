import type { SolveOutput } from "@/lib/solver";
import { CountUp } from "./count-up";

type Props = { week: SolveOutput; variant: "plan" | "drop" | "mini" | "proof"; title?: string; printedAt?: string };

const Row = ({ l, r, strong }: { l: string; r: string; strong?: boolean }) => (
  <div className="flex items-baseline py-1">
    <span className={strong ? "font-medium" : ""}>{l}</span>
    <span className="leader" />
    <span className={strong ? "font-medium" : "text-ink-2"}>{r}</span>
  </div>
);

const DAY: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };

// the /drop receipt (REDESIGN-V4 §3): a white card with light gray rules, Inter tnum, sentence case.
export function ReceiptCard({ week, variant, title = "Your week, solved", printedAt }: Props) {
  const mini = variant === "mini";
  const proof = variant === "proof";
  const list = mini ? week.list.slice(0, 4) : week.list;
  const perishable = week.list.filter((i) => i.perishable);
  const shelf = week.list.filter((i) => !i.perishable);
  const price = (i: { price_usd: number }) => (i.price_usd === 0 ? "Pantry" : `$${i.price_usd.toFixed(2)}`);
  const qty = (i: { qty: number; name: string }) => `${i.qty > 1 ? `${i.qty} x ` : ""}${i.name}`;
  return (
    <div className={`w-full rounded-card border border-border bg-white px-5 pt-6 pb-5 text-sm text-ink shadow-card tnum ${mini ? "" : "max-w-sm"}`}>
      <p className="text-center font-display text-base font-extrabold tracking-[-0.02em]">WiseDinner</p>
      <p className="mt-1 text-center text-ink-2">{title}</p>

      {/* day rows only on /drop, where the receipt is the sole day listing */}
      {variant === "drop" &&
        week.days.map((d) => (
          <div key={d.day} className="mt-3 border-t border-border pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{DAY[d.day] ?? d.day}</span>
              <span className="text-ink-2">
                {d.protein_g}g protein, {d.kcal} kcal
              </span>
            </div>
            <p className="mt-0.5 text-ink-2">{d.items.map((i) => i.name).join(", ")}</p>
          </div>
        ))}
      {!mini && (
        <>
          <p className="mt-5 text-xs font-medium text-ink-2">Fresh aisle</p>
          {perishable.map((i) => (
            <Row key={i.name} l={qty(i)} r={price(i)} />
          ))}
          <p className="mt-3 text-xs font-medium text-ink-2">Shelf and freezer</p>
          {shelf.map((i) => (
            <Row key={i.name} l={qty(i)} r={price(i)} />
          ))}
        </>
      )}
      {mini && list.map((i) => <Row key={i.name} l={qty(i)} r={`$${i.price_usd.toFixed(2)}`} />)}

      <div className="my-3 border-t border-border" />
      <div className="flex items-baseline">
        <span className="font-medium">Estimated in-store total</span>
        <span className="leader" />
        {mini || proof ? <span className={`${proof ? "text-2xl" : "text-xl"} font-semibold`}>${week.est_total.toFixed(2)}</span> : <CountUp value={week.est_total} prefix="$" className="text-2xl font-semibold" />}
      </div>
      <div className="flex items-baseline py-1">
        <span>Protein a day</span>
        <span className="leader" />
        <span className="font-medium text-emerald-ink">{week.protein_per_day}g</span>
      </div>
      {variant === "drop" && <Row l="Calories a day" r={`${week.kcal_per_day}`} />}
      <Row l="Food wasted" r="0" />
      {proof && <p className="mt-3 text-center text-[0.75rem] text-ink-2">Prices refreshed every Sunday</p>}
      {!proof && (
        <p className="mt-3 text-center text-xs text-ink-2">
          Prices as of {week.price_as_of}
          {printedAt ? `, printed ${printedAt}` : ""}
        </p>
      )}
    </div>
  );
}
