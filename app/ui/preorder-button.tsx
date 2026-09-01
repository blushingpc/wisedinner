import { site } from "@/content/site";

// text pre-order CTA. yolk = default primary; ink = ink ground with yolk text (final CTA only).
// short: below md the label is just "pre-order →" so the header fits narrow phones.
// placement: data-placement attribute for later analytics — attributes only, no wiring.
export function PreorderButton({
  variant = "yolk",
  short = false,
  placement,
  className = "",
}: {
  variant?: "yolk" | "ink";
  short?: boolean;
  placement?: string;
  className?: string;
}) {
  return (
    <a
      href={site.appStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-placement={placement}
      className={`cta ${variant === "ink" ? "cta-ink" : ""} ${className}`}
    >
      pre-order{short ? <span className="hidden md:inline">&nbsp;on the App Store</span> : " on the App Store"} →
    </a>
  );
}
