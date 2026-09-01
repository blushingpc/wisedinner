import { appStoreUrl } from "@/content/site";

// text pre-order CTA. yolk = default primary; ink = ink ground with yolk text (final CTA only).
// short: narrow phones drop " on the App Store" so the header fits 390px.
export function PreorderButton({ variant = "yolk", short = false, className = "" }: { variant?: "yolk" | "ink"; short?: boolean; className?: string }) {
  return (
    <a href={appStoreUrl} target="_blank" rel="noopener" className={`cta ${variant === "ink" ? "cta-ink" : ""} ${className}`}>
      pre-order{short ? <span className="hidden min-[480px]:inline">&nbsp;on the App Store</span> : " on the App Store"} →
    </a>
  );
}
