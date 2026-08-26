import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import PWARegister from "@/components/common/PWARegister";

// --- PWA Viewport: Prevents iOS auto-zoom, enables edge-to-edge rendering ---
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#064e3b",
};

// --- PWA Metadata: Apple Web App capabilities, manifest, Open Graph ---
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://rabbitpos.ndnworks.com'),
  title: "ThoPOS - Thỏ Juice & Coffee",
  description: "Hệ thống Bán hàng & Quản lý Tài chính RabbitPOS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ThoPOS",
  },
  formatDetection: {
    telephone: false,
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
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-600 selection:text-white flex flex-col">
        {/* Register service worker for offline shell caching */}
        <PWARegister />
        <LanguageProvider>
          <ConfirmProvider>
            <main className="flex-1 flex flex-col w-full max-w-full md:max-w-7xl mx-auto shadow-sm bg-white min-h-0 overflow-x-hidden">
              {children}
            </main>
          </ConfirmProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
