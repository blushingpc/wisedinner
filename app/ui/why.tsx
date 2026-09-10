import { Calculator, Leaf, Tag } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/content/site";
import { Section, SectionHeading } from "./section";

// SECTION 3 (REDESIGN-V4 §6): centered H2 and subline, three white cards on the gray surface, each with an emerald
// line icon on its tint tile. §7 copy verbatim.
const ICONS = { calculator: Calculator, tag: Tag, leaf: Leaf } as const;

export function Why() {
  return (
    <Section alt lazy>
      <SectionHeading sub={site.why.sub}>{site.why.h2}</SectionHeading>
      <ul className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6">
        {site.why.items.map((it) => {
          const Icon = ICONS[it.icon as keyof typeof ICONS];
          return (
            <li key={it.title} className="lift rounded-card border border-border bg-white p-6 lg:p-8">
              <span className="grid size-12 place-items-center rounded-[12px] bg-emerald-tint text-emerald">
                <Icon size={26} weight="regular" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-h3 text-balance">{it.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">{it.body}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
