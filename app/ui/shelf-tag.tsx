// shelf-tag: the price motif — yolk, mono, slightly rotated (DESIGN-AUDIT §6). every marketing price wears one.
export function ShelfTag({ label, sub, className = "" }: { label: string; sub?: string; className?: string }) {
  return (
    <p className={`inline-block -rotate-2 rounded-[4px] bg-yolk px-3 py-1.5 font-mono tabular-nums text-ink shadow-tag ${className}`}>
      <span className="text-xl font-medium">{label}</span>
      {sub && <span className="ml-2 text-spec">{sub}</span>}
    </p>
  );
}
