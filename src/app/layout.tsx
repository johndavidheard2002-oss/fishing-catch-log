import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { APP_DISPLAY_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  PWA_APPLE_TOUCH_ICON,
  PWA_ICON_192,
  PWA_ICON_512,
  PWA_THEME_COLOR,
  appleStartupImageMetadata,
} from "@/lib/pwa";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: APP_DISPLAY_NAME, template: `%s · ${APP_DISPLAY_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_DISPLAY_NAME,
  openGraph: {
    title: APP_DISPLAY_NAME,
    description: APP_TAGLINE,
    siteName: APP_DISPLAY_NAME,
    images: [{ url: PWA_ICON_512, width: 512, height: 512, alt: APP_DISPLAY_NAME }],
  },
  appleWebApp: {
    capable: true,
    title: APP_DISPLAY_NAME,
    statusBarStyle: "default",
    startupImage: appleStartupImageMetadata(),
  },
  icons: {
    icon: [
      { url: PWA_ICON_192, sizes: "192x192", type: "image/png" },
      { url: PWA_ICON_512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: PWA_APPLE_TOUCH_ICON, sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  // Next.js maps appleWebApp.capable to mobile-web-app-capable; iPhone Safari
  // still needs the Apple name for standalone + splash.
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": APP_DISPLAY_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: PWA_THEME_COLOR,
  // Required for env(safe-area-inset-*) in Capacitor WKWebView and iOS PWA.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href={PWA_APPLE_TOUCH_ICON} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
