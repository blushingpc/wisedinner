import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "wisedinner",
  description:
    "a weekly budget and a protein target in. one small grocery list, five days of meals, nothing wasted out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
