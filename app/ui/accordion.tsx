import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

// native <details>: keyboard, a11y and no-JS for free. hairline rows, no boxes (REDESIGN-V4 §6).
export function Accordion({ items }: { items: { q: string; a: string; more?: { label: string; href: string } }[] }) {
  return (
    <div className="border-t border-border">
      {items.map(({ q, a, more }) => (
        <details key={q} className="group border-b border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            {q}
            <Plus size={20} weight="bold" aria-hidden="true" className="shrink-0 text-ink-2 transition-transform duration-200 ease-press group-open:rotate-45" />
          </summary>
          <p className="max-w-[62ch] pb-6 text-ink-2">
            {a}
            {more && (
              <>
                {" "}
                <Link href={more.href} className="text-link text-ink">
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
