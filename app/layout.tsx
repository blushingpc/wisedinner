import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Reveal } from "./reveal";
import { Nav } from "./ui/nav";
import { Footer } from "./ui/footer";
import { SITE } from "./copy";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["400", "500", "700", "800"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "WiseDinner — hit your protein, spend way less",
  description: "Turn your budget and protein target into a solved grocery week. One short list, five days of meals, zero waste.",
  alternates: { canonical: "/" },
  openGraph: { siteName: "wisedinner", type: "website", images: ["/og"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-base text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-(--z-toast) focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
          skip to content
        </a>
        <Nav />
        {children}
        <Footer />
        <Reveal />
        <Analytics />
      </body>
    </html>
  );
}
