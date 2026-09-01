// the live-preview line — shared by the inline demo card and the walkthrough step-1 phone screen
export function PreviewLine({ budget, protein, items, className = "" }: { budget: number; protein: number; items: number; className?: string }) {
  const b = "font-semibold tabular-nums text-ink";
  return (
    <p className={`text-ink-soft ${className}`}>
      <span className={b}>${budget}</span> → 5 dinners · <span className={b}>{protein} g</span> a day · ~<span className={b}>{items}</span> items
    </p>
  );
}
