import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import PWARegister from "@/components/common/PWARegister";

// --- PWA Viewport: Prevents iOS auto-zoom, enables edge-to-edge rendering ---
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0F5132",
};

// --- PWA Metadata: Apple Web App capabilities, manifest, Open Graph ---
export const metadata: Metadata = {
  title: "ThoPOS - Thỏ Juice & Coffee",
  description: "Hệ thống Bán hàng & Quản lý Tài chính RabbitPOS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
    <html lang="vi" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased selection:bg-emerald-600 selection:text-white pwa-body overflow-hidden">
        {/* Register service worker for offline shell caching */}
        <PWARegister />
        <LanguageProvider>
          <main className="h-full flex flex-col max-w-md md:max-w-4xl lg:max-w-7xl mx-auto shadow-sm bg-white overflow-hidden">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}

