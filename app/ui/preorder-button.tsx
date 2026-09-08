import { AppStoreLink } from "./app-store-link";

// text pre-order CTA. forest = default primary; ink = ink ground with forest text (final CTA only).
// short: below md the label is just "pre-order →" so the header fits narrow phones.
// placement: data-placement attribute for later analytics — attributes only, no wiring.
export function PreorderButton({
  variant = "forest",
  short = false,
  placement,
  className = "",
}: {
  variant?: "forest" | "ink";
  short?: boolean;
  placement?: string;
  className?: string;
}) {
  return (
    <AppStoreLink placement={placement} short={short} className={`cta ${variant === "ink" ? "cta" : ""} ${className}`}>
      pre-order{short ? <span className="hidden md:inline">&nbsp;on the App Store</span> : " on the App Store"} →
    </AppStoreLink>
  );
}
