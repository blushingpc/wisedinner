import Link from "next/link";

// brand lockup (REDESIGN-V3 §2B): "w." mark 22px + "wisedinner" Bricolage 700 lowercase, 8px gap. mark is vector,
// wordmark is always type — never a rasterized wordmark
export function Wordmark({ className = "text-lg" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static svg, no optimization needed */}
      <img src="/logo/wisedinner-mark.svg" alt="" width={22} height={22} aria-hidden="true" />
      wisedinner
    </Link>
  );
}
