// PAGE SHELL (REDESIGN-V4 §10.18b): every secondary page shares this layout: a centered H1 (with an optional sub) on
// the py-band rhythm, then the page body in a measured column (or full width when the page needs it).
export function PageShell({ title, sub, children, wide = false, className = "" }: { title: React.ReactNode; sub?: string; children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <main id="main">
      <section className="bg-white py-band">
        <div className={`mx-auto px-6 lg:px-12 ${wide ? "max-w-[1200px]" : "max-w-[760px]"} ${className}`}>
          <div className="mx-auto max-w-[40ch] text-center">
            <h1 className="text-h1 text-balance">{title}</h1>
            {sub && <p className="mt-5 text-lg text-ink-2">{sub}</p>}
          </div>
          <div className="mt-12 lg:mt-16">{children}</div>
        </div>
      </section>
    </main>
  );
}
