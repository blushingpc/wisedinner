// SectionShell: rhythm + container. reveal enhancement comes from [data-reveal] + app/reveal.tsx; content is visible by default.
export function Section({ children, alt, id, className = "", lazy = false }: { children: React.ReactNode; alt?: boolean; id?: string; className?: string; lazy?: boolean }) {
  return (
    <section id={id} className={`${alt ? "bg-green-050" : ""} ${lazy ? "cv-auto" : ""} py-band`}>
      <div className={`mx-auto max-w-[1200px] px-6 lg:px-12 ${className}`}>{children}</div>
    </section>
  );
}
