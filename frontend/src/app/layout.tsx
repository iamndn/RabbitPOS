import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import PWARegister from "@/components/common/PWARegister";

// --- PWA Viewport: Prevents iOS auto-zoom on input focus, enables edge-to-edge rendering ---
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F5132" },
    { media: "(prefers-color-scheme: dark)", color: "#0F5132" },
  ],
};

// --- PWA Metadata: Apple Web App capabilities, manifest, Open Graph ---
export const metadata: Metadata = {
  title: "ThoPOS - Thỏ Juice & Coffee",
  description: "Hệ thống Quản lý Bán hàng & Tài chính RabbitPOS",
  manifest: "/manifest.json",
  // iOS standalone full-screen mode
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ThoPOS",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Thỏ Juice & Coffee - RabbitPOS",
    description: "Phần mềm quản lý bán hàng POS & Sổ thu chi cho Thỏ Juice & Coffee",
    url: "https://rabbitpos.ndnworks.com",
    siteName: "Thỏ Juice & Coffee",
    images: [
      {
        url: "/logo.png",
        width: 256,
        height: 256,
        alt: "Thỏ Juice & Coffee Logo",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Thỏ Juice & Coffee - RabbitPOS",
    description: "Phần mềm quản lý bán hàng POS & Sổ thu chi cho Thỏ Juice & Coffee",
    images: ["/logo.png"],
  },
  // W3C standard equivalent of apple-mobile-web-app-capable.
  // Suppresses Chrome's deprecation warning: "apple-mobile-web-app-capable is deprecated,
  // please include mobile-web-app-capable".
  other: {
    "mobile-web-app-capable": "yes",
  },

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      {/*
        iOS PWA: apple-mobile-web-app-* meta tags are injected via Next.js appleWebApp metadata above.
        The body uses env(safe-area-inset-*) for full notch/Dynamic Island/home indicator support.
      */}
      <body className="h-full bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white pwa-body">
        {/* Register service worker for offline shell caching */}
        <PWARegister />
        <LanguageProvider>
          <main className="min-h-full flex flex-col max-w-md md:max-w-4xl lg:max-w-7xl mx-auto shadow-sm bg-white">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}
