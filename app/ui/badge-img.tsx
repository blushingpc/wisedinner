// the one badge image (MOBILE FIX PASS v2 §A): official artwork inside a fixed-aspect box. shared by StoreBadges and
// the pre-order modal; lives apart from store-badges.tsx so the modal (a client module) never imports the server side.
const BADGE = {
  apple: { src: "/badges/app-store-preorder.svg", w: 119.664, h: 40, alt: "Pre-order on the App Store" },
  play: { src: "/badges/google-play.svg", w: 180, h: 53.333, alt: "Get it on Google Play" },
} as const;

// one badge image at a given height inside a box that holds the artwork's own ratio, so a flex or grid parent can
// never squeeze it (the header badge overflowed its frame on phones before this box existed)
export function BadgeImg({ kind, height }: { kind: keyof typeof BADGE; height: number }) {
  const b = BADGE[kind];
  const width = Math.round((b.w / b.h) * height);
  return (
    <span className="block shrink-0 overflow-hidden" style={{ width, height, aspectRatio: `${b.w} / ${b.h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the store's own svg, served as-is */}
      <img src={b.src} alt={b.alt} width={width} height={height} className="block h-full w-full" />
    </span>
  );
}
