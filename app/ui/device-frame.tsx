// DeviceFrame v2: three-layer bezel, dynamic island, 9:41 status bar, diagonal glare, layered shadow,
// desktop-only perspective tilt. children are REAL components, never screenshots. fixed dims → zero CLS.
export function DeviceFrame({ children, className = "", label, tilt }: { children: React.ReactNode; className?: string; label: string; tilt?: "left" | "right" }) {
  const persp = tilt === "left" ? "lg:[transform:perspective(1200px)_rotateY(-4deg)]" : tilt === "right" ? "lg:[transform:perspective(1200px)_rotateY(3deg)]" : "";
  return (
    <div
      role="img"
      aria-label={label}
      className={`w-[320px] shrink-0 rounded-[54px] bg-ink p-[10px] shadow-frame ${persp} ${className}`}
      style={{ height: 660 }}
    >
      <div className="frame-glare relative h-full rounded-[44px] border border-white/14 bg-ink p-[3px]">
        <div className="relative h-full overflow-hidden rounded-[40px] bg-bg">
          <div className="flex items-center justify-between px-7 pt-3" aria-hidden="true">
            <span className="font-mono text-micro font-medium tabular-nums">9:41</span>
            <span className="h-6 w-24 rounded-full bg-ink" />
            <span className="font-mono text-micro tracking-normal">●●●</span>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-hidden px-5 pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
