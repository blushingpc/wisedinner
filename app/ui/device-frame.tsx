// CSS phone. children are real components, never screenshots. fixed dims → zero CLS.
export function DeviceFrame({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`w-[320px] shrink-0 overflow-hidden rounded-[44px] border-[10px] border-ink bg-bg shadow-receipt ${className}`}
      style={{ height: 660 }}
    >
      <div className="mx-auto mt-3 h-6 w-28 rounded-full bg-ink" aria-hidden="true" />
      <div className="h-[calc(100%-2.25rem)] overflow-hidden px-5 pt-5">{children}</div>
    </div>
  );
}
