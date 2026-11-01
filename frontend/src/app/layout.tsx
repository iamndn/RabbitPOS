import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { StoreProvider } from "@/lib/StoreContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ToastProvider } from "@/context/ToastContext";
import PWARegister from "@/components/common/PWARegister";

// --- Self-hosted Inter Variable (Fallback for non-Apple platforms & tabular numerals per Override Q1) ---
const inter = localFont({
  src: [
    {
      path: "../fonts/inter-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/inter-vietnamese-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "SF Pro Text",
    "SF Pro Display",
    "system-ui",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
});

// --- PWA Viewport: Prevents iOS auto-zoom, enables edge-to-edge rendering ---
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F2F4F8",
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
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('rabbitpos_glass_effects')==='false'){document.documentElement.classList.add('no-glass');}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen bg-canvas text-slate-900 font-sans antialiased selection:bg-brand-600 selection:text-white flex flex-col">
        {/* Register service worker for offline shell caching */}
        <PWARegister />
        <LanguageProvider>
          <StoreProvider>
            <ToastProvider>
              <ConfirmProvider>
                <main className="flex-1 flex flex-col w-full min-h-0 overflow-x-hidden bg-canvas">
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
