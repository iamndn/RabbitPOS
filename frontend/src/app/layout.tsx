import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RabbitPOS - Takeaway Point of Sale",
  description: "High-performance POS and financial management for Tho Juice & Coffee",
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
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
        <main className="min-h-full flex flex-col max-w-md md:max-w-4xl lg:max-w-7xl mx-auto shadow-sm bg-white">
          {children}
        </main>
      </body>
    </html>
  );
}
