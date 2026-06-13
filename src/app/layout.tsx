import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import Script from "next/script";

import { getUiPreferences } from "@/lib/preferences";
import { PreferenceSync } from "@/components/preference-sync";
import { TelegramViewport } from "@/components/telegram-viewport";
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
  const { language, theme, themePref, languagePref } = await getUiPreferences();

  return (
    <html
      lang={language}
      className={`${manrope.variable} ${plexMono.variable} h-full`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased">
        {/* Official Telegram bridge — populates window.Telegram.WebApp (BackButton,
            HapticFeedback, swipes, colorScheme, ready). Must load before hydration. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <PreferenceSync themePref={themePref} languagePref={languagePref} />
        <TelegramViewport />
        {children}
      </body>
    </html>
  );
}
