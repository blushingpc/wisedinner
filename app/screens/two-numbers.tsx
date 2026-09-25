import { Button, Screen } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

// S7 TWO NUMBERS (SITE-V5 §2): the onboarding's two inputs on one screen, both filled in, and the solve button.
// Same chrome and type as S5: Plus Jakarta title, Inter numbers with tnum, forest primary button. Static: a picture of
// the app, nothing here takes input. `budget` and `protein` are the display strings ("$60", "150g").
export function TwoNumbers({ budget, protein }: { budget: string; protein: string }) {
  return (
    <Screen>
      <StatusBar />
      <div className="mt-[3.75em] px-[1.25em]">
        <p className="font-display text-[1.625em] leading-none font-extrabold tracking-[-0.02em]">Two numbers</p>
        <p className="mt-[0.5em] text-[0.875em] text-ink-2">Budget and protein.</p>
      </div>
      <div className="mt-[1.5em] grid gap-[0.75em] px-[1.25em]">
        <Field label="Weekly budget" value={budget} note="Groceries only" />
        <Field label="Protein a day" value={protein} note="Per person" />
      </div>
      <div className="mt-auto px-[1.25em] pb-[2.4em]" data-solve>
        <Button>Solve my week</Button>
      </div>
    </Screen>
  );
}

function Field({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[0.875em] border border-border bg-white px-[1em] py-[0.9em]">
      <p className="text-[0.8125em] font-medium text-ink-2">{label}</p>
      <p className="mt-[0.2em] text-[2.5em] leading-none font-semibold tracking-tight tnum">{value}</p>
      <p className="mt-[0.35em] text-[0.75em] text-ink-2">{note}</p>
    </div>
  );
}
