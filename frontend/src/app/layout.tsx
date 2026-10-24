import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { StoreProvider } from "@/lib/StoreContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ToastProvider } from "@/context/ToastContext";
import PWARegister from "@/components/common/PWARegister";

// --- PWA Viewport: Prevents iOS auto-zoom, enables edge-to-edge rendering ---
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3b0764",
};

// --- PWA Metadata: Apple Web App capabilities, manifest, Open Graph ---
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://rabbitpos.ndnworks.com'),
  title: "RabbitPOS - Cloud POS & F&B Operations",
  description: "Hệ thống Bán hàng & Quản lý Tài chính RabbitPOS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RabbitPOS",
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
    title: "RabbitPOS - Cloud POS & F&B Operations",
    description: "Hệ thống Bán hàng Đa Chi Nhánh & Quản lý Tài chính Toàn Diện RabbitPOS",
    url: "https://rabbitpos.ndnworks.com",
    siteName: "RabbitPOS",
    images: [
      {
        url: "/logo.png",
        width: 256,
        height: 256,
        alt: "RabbitPOS Logo",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "RabbitPOS - Cloud POS & F&B Operations",
    description: "Hệ thống Bán hàng Đa Chi Nhánh & Quản lý Tài chính Toàn Diện RabbitPOS",
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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-purple-600 selection:text-white flex flex-col">
        {/* Register service worker for offline shell caching */}
        <PWARegister />
        <LanguageProvider>
          <StoreProvider>
            <ToastProvider>
              <ConfirmProvider>
                <main className="flex-1 flex flex-col w-full min-h-0 overflow-x-hidden bg-slate-50">
                  {children}
                </main>
              </ConfirmProvider>
            </ToastProvider>
          </StoreProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
