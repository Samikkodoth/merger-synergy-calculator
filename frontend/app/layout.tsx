import type { Metadata } from "next";
import { Libre_Caslon_Text, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
});

const caslon = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caslon",
});

export const metadata: Metadata = {
  title: "Merger Synergy Calculator",
  description: "Estimate M&A synergies and EPS accretion/dilution",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${publicSans.variable} ${caslon.variable}`}>
      <body className="bg-paper font-sans text-body text-ink antialiased">{children}</body>
    </html>
  );
}