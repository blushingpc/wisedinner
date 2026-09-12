// SectionShell (REDESIGN-V4 §3): py-band rhythm (56px mobile, 96px desktop), 1200px container, optional gray surface.
export function Section({ children, alt, id, className = "", lazy = false }: { children: React.ReactNode; alt?: boolean; id?: string; className?: string; lazy?: boolean }) {
  return (
    <section id={id} className={`${alt ? "bg-surface" : "bg-white"} ${lazy ? "cv-auto" : ""} py-band`}>
      <div className={`mx-auto max-w-[1200px] px-6 lg:px-12 ${className}`}>{children}</div>
    </section>
  );
}

// centered section header (§6): Plus Jakarta 800 at 2.25rem, an optional one-line sub in Inter beneath
export function SectionHeading({ children, sub, className = "" }: { children: React.ReactNode; sub?: string; className?: string }) {
  return (
    <div className={`mx-auto max-w-[36ch] text-center ${className}`}>
      <h2 className="text-h2 text-balance">{children}</h2>
      {sub && <p className="mt-3 text-lg text-ink-2">{sub}</p>}
    </div>
  );
}
