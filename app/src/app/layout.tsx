import type { Metadata } from "next";
import { Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/bold";
import "@phosphor-icons/web/fill";
import "./globals.css";

// Fonts self-hosted via next/font/google (not a CDN @import — see the
// comment in globals.css about why a remote CSS @import doesn't survive
// Tailwind v4's bundling) and mapped onto the design system's --font-sans/
// --font-mono tokens there. Icons are the Phosphor npm package, imported
// directly so webpack/Turbopack bundles them as real CSS chunks instead of
// runtime @import statements — see DESIGN_SYSTEM.md.
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-source-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Harbour House Sports Club — Range Booking",
  description: "Book range slots at Harbour House Sports Club, Co. Kildare.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
