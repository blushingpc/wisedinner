import { Button, Screen } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

// S5 ONBOARDING (REDESIGN-V3 §3): "your weekly budget", one big mono number on a number pad, next. step 1 of 6.
export function Onboarding({ value = "$55", step = 1 }: { value?: string; step?: number }) {
  return (
    <Screen>
      <StatusBar />
      <div className="mt-[3.75em] px-[1.25em]">
        <p className="text-[0.75em] font-semibold text-ink-soft">{step} of 6</p>
        <p className="mt-[0.4em] text-[1.625em] leading-none font-bold tracking-[-0.02em]">your weekly budget</p>
        <p className="mt-[0.5em] text-[0.875em] text-ink-soft">groceries only. we plan five days inside it.</p>
      </div>
      <p className="mt-[1.4em] text-center font-mono text-[3.5em] leading-none font-semibold tracking-tight">{value}</p>
      <div className="mx-auto mt-auto mb-[0.75em] grid w-[88%] grid-cols-3 gap-[0.5em]">
        {KEYS.map((k) => (
          <span key={k} className={`grid h-[3.1em] place-items-center rounded-[0.875em] font-mono text-[1.25em] font-medium ${k === "⌫" || k === "." ? "text-ink-soft" : "bg-white shadow-[0_1px_0_rgba(27,26,24,0.06)]"}`}>
            {k}
          </span>
        ))}
      </div>
      <div className="px-[1.25em] pb-[2.4em]">
        <Button>next</Button>
      </div>
    </Screen>
  );
}
