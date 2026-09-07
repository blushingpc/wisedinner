import { CalendarDots, ListChecks, Receipt, GearSix } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

// app chrome shared by every screen (REDESIGN-V3 §2A/§3). sizes are em off the screen's 16pt base — see DeviceFrame v3.
// these are the REAL screens: props-driven, fixture-fed, copied by the Expo app later.

export function Screen({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return <div className={`absolute inset-0 flex flex-col overflow-hidden ${dark ? "bg-kale text-bg" : "bg-bg text-ink"} ${className}`}>{children}</div>;
}

// top 3.75em clears the dynamic island + status bar
export function Header({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <div className="mt-[3.75em] flex items-end justify-between px-[1.25em]">
      <div>
        <h3 className="text-[1.625em] leading-none font-bold tracking-[-0.02em]">{title}</h3>
        {sub && <p className="mt-[0.35em] text-[0.8125em] font-medium text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// the yolk mono pill — the app's price motif ("$49.20 · one trip")
export function Pill({ children, tone = "yolk" }: { children: ReactNode; tone?: "yolk" | "kale" | "paper" }) {
  const t = tone === "yolk" ? "bg-yolk text-ink" : tone === "kale" ? "bg-kale text-bg" : "bg-bg-alt text-ink";
  return <span className={`inline-flex items-center rounded-full px-[0.75em] py-[0.35em] font-mono text-[0.8125em] font-semibold whitespace-nowrap ${t}`}>{children}</span>;
}

export function Button({ children, tone = "yolk", className = "" }: { children: ReactNode; tone?: "yolk" | "ghost" | "kale"; className?: string }) {
  const t = tone === "yolk" ? "bg-yolk text-ink" : tone === "kale" ? "bg-kale text-bg" : "bg-transparent text-ink shadow-[inset_0_0_0_1.5px_currentColor]";
  return <span className={`flex min-h-[3.25em] items-center justify-center rounded-[0.875em] px-[1.25em] text-[1em] font-bold ${t} ${className}`}>{children}</span>;
}

const TABS = [
  ["this week", CalendarDots],
  ["list", ListChecks],
  ["receipts", Receipt],
  ["settings", GearSix],
] as const;

export type Tab = (typeof TABS)[number][0];

export function TabBar({ active }: { active: Tab }) {
  return (
    <div className="mt-auto border-t border-rule bg-bg px-[0.5em] pt-[0.5em] pb-[1.6em]">
      <div className="grid grid-cols-4">
        {TABS.map(([label, Icon]) => {
          const on = label === active;
          return (
            <div key={label} className={`flex flex-col items-center gap-[0.2em] text-[0.625em] font-semibold ${on ? "text-ink" : "text-ink-3"}`}>
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

// the brand lockup inside app surfaces (share card): mark + wordmark, both ink
export function Lockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.4em] font-bold tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static svg */}
      <img src="/logo/wisedinner-mark.svg" alt="" width={22} height={22} aria-hidden="true" className="size-[1.1em]" />
      wisedinner
    </span>
  );
}
