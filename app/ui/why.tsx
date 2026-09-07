import { Calculator, Leaf, Tag } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/content/site";

// SECTION 3 — "why wisedinner" (REDESIGN-V3 §4): three cards, a Phosphor line glyph on a paper-alt tile, §6 copy verbatim.
const ICONS = { calculator: Calculator, tag: Tag, leaf: Leaf } as const;

export function Why() {
  return (
    <section className="bg-white py-band">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <h2 className="text-h2 font-bold text-balance">{site.why.h2}</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-3 lg:mt-12">
          {site.why.items.map((it) => {
            const Icon = ICONS[it.icon as keyof typeof ICONS];
            return (
              <li key={it.title} className="lift rounded-[14px] border border-rule bg-bg p-6 lg:p-8">
                <span className="grid size-12 place-items-center rounded-[12px] bg-bg-alt text-kale">
                  <Icon size={26} weight="regular" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-[1.375rem] leading-tight font-bold">{it.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{it.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
