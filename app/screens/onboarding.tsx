import { Button, Screen } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

// S5 ONBOARDING (REDESIGN-V4 §8): "Your weekly budget", one big Inter number over a number pad, Next. Step 1 of 6.
export function Onboarding({ value = "$55", step = 1 }: { value?: string; step?: number }) {
  return (
    <Screen>
      <StatusBar />
      <div className="mt-[3.75em] px-[1.25em]">
        <p className="text-[0.75em] font-medium text-ink-2 tnum">
          {step} of 6
        </p>
        <p className="mt-[0.4em] font-display text-[1.625em] leading-none font-extrabold tracking-[-0.02em]">Your weekly budget</p>
        <p className="mt-[0.5em] text-[0.875em] text-ink-2">Groceries only. We plan five days inside it.</p>
      </div>
      <p className="mt-[1.4em] text-center text-[3.5em] leading-none font-semibold tracking-tight tnum">{value}</p>
      <div className="mx-auto mt-auto mb-[0.75em] grid w-[88%] grid-cols-3 gap-[0.5em]">
        {KEYS.map((k) => (
          <span key={k} className={`grid h-[3.1em] place-items-center rounded-[0.75em] text-[1.25em] font-medium tnum ${k === "⌫" || k === "." ? "text-ink-2" : "border border-border bg-white"}`}>
            {k}
          </span>
        ))}
      </div>
      <div className="px-[1.25em] pb-[2.4em]">
        <Button>Next</Button>
      </div>
    </Screen>
  );
}
