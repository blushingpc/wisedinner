import Link from "next/link";

// native <details>: keyboard, a11y and no-JS for free. hairline rows, no boxes.
export function Accordion({ items }: { items: { q: string; a: string; more?: { label: string; href: string } }[] }) {
  return (
    <div className="border-t border-rule">
      {items.map(({ q, a, more }) => (
        <details key={q} className="group border-b border-rule">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            {q}
            <span aria-hidden="true" className="font-mono text-ink-soft transition-transform duration-200 ease-press group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="max-w-[62ch] pb-5 text-ink-soft">
            {a}
            {more && (
              <>
                {" "}
                <Link href={more.href} className="text-link">
                  {more.label}
                </Link>
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}
