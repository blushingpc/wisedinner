import Link from "next/link";

// mark is vector, wordmark is always type (Bricolage 700 lowercase) — never a rasterized wordmark
export function Wordmark({ className = "text-lg" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static svg, no optimization needed */}
      <img src="/logo/wisedinner-mark.svg" alt="" width={20} height={20} aria-hidden="true" />
      wisedinner
    </Link>
  );
}
