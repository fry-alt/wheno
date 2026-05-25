import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import { getUiPreferences } from "@/lib/preferences";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "wheno",
  description: "A Telegram Mini App that helps groups find the best time to meet.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { language, theme } = await getUiPreferences();

  return (
    <html
      lang={language}
      className={`${manrope.variable} ${plexMono.variable} h-full`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
