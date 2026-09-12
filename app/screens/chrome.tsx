import { CalendarDots, ListChecks, Receipt, GearSix } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

// app chrome shared by every screen (REDESIGN-V4 §8): white screens, #111 text, forest primary buttons, emerald checks,
// Inter numbers with tnum, Plus Jakarta Sans titles. sizes are em off the screen's 16pt base (see DeviceFrame).
// these are the REAL screens: props-driven, fixture-fed, copied by the Expo app later.

export function Screen({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return <div className={`absolute inset-0 flex flex-col overflow-hidden ${dark ? "bg-forest text-white" : "bg-white text-ink"} ${className}`}>{children}</div>;
}

// top 3.75em clears the dynamic island + status bar
export function Header({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <div className="mt-[3.75em] flex items-end justify-between gap-[0.75em] px-[1.25em]">
      <div className="min-w-0">
        <p className="font-display text-[1.625em] leading-none font-extrabold tracking-[-0.02em]">{title}</p>
        {sub && <p className="mt-[0.4em] text-[0.8125em] font-medium text-ink-2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// the forest tag: the app's price motif (the week's total, then "one trip")
export function Pill({ children, tone = "forest" }: { children: ReactNode; tone?: "forest" | "surface" | "emerald" }) {
  const t = tone === "forest" ? "bg-forest text-white" : tone === "emerald" ? "bg-emerald-tint text-forest" : "bg-surface text-ink";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-[0.75em] py-[0.4em] text-[0.8125em] font-semibold whitespace-nowrap tnum ${t}`}>{children}</span>;
}

export function Button({ children, tone = "forest", className = "" }: { children: ReactNode; tone?: "forest" | "ghost"; className?: string }) {
  const t = tone === "forest" ? "bg-forest text-white" : "bg-white text-ink shadow-[inset_0_0_0_1.5px_var(--color-border)]";
  return <span className={`flex min-h-[3.25em] items-center justify-center rounded-[0.75em] px-[1.25em] text-[1em] font-semibold ${t} ${className}`}>{children}</span>;
}

const TABS = [
  ["This week", CalendarDots],
  ["List", ListChecks],
  ["Receipts", Receipt],
  ["Settings", GearSix],
] as const;

export type Tab = (typeof TABS)[number][0];

export function TabBar({ active }: { active: Tab }) {
  return (
    <div className="mt-auto border-t border-border bg-white px-[0.5em] pt-[0.5em] pb-[1.6em]">
      <div className="grid grid-cols-4">
        {TABS.map(([label, Icon]) => {
          const on = label === active;
          return (
            <div key={label} className={`flex flex-col items-center gap-[0.2em] text-[0.625em] font-semibold ${on ? "text-forest" : "text-ink-2"}`}>
              <Icon size="1.9em" weight={on ? "fill" : "regular"} />
              <span>{label}</span>
            </div>
          );
        })}
      </div>
      {/* home indicator */}
      <div className="mx-auto mt-[0.6em] h-[0.3em] w-[8.5em] rounded-full bg-ink/85" />
    </div>
  );
}

// the brand lockup inside app surfaces (share card): em-sized off the screen font
export { LockupEm as Lockup } from "@/app/lockup";
