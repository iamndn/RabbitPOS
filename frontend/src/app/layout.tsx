import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata: Metadata = {
  title: "Thỏ Juice & Coffee - RabbitPOS",
  description: "Phần mềm quản lý bán hàng POS & Sổ thu chi cho Thỏ Juice & Coffee",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
        <LanguageProvider>
          <main className="min-h-full flex flex-col max-w-md md:max-w-4xl lg:max-w-7xl mx-auto shadow-sm bg-white">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}
