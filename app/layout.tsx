import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Reveal } from "./reveal";
import { Nav } from "./ui/nav";
import { Footer } from "./ui/footer";
import { SITE } from "./copy";
import "./globals.css";

// REDESIGN-V4 §3: Plus Jakarta Sans for headings and the wordmark, Inter for body, UI and every number. both self-hosted
// by next/font (no link tags); the variable files cover every weight in one request each.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["700", "800"], display: "swap", preload: true });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: true });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "WiseDinner. Hit your protein. Spend way less.",
  description: "Tell WiseDinner your weekly grocery budget and your daily protein goal. It plans five days of meals, builds one short grocery list, and shows you the total before you shop.",
  alternates: { canonical: "/" },
  openGraph: { siteName: "WiseDinner", type: "website", images: ["/og/home.png"] }, // REDESIGN-V3 §2B: composed from the real components by scripts/og-card.ts
};

// the browser chrome takes the page ground: white
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-white font-sans text-base text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-(--z-toast) focus:rounded-cta focus:bg-forest focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <Nav />
        {children}
        <Footer />
        <Reveal />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
