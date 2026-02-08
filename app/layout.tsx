import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/ToastContext";
import { ModalProvider } from "@/components/ui/ModalContext";
import QueryProvider from "@/components/providers/QueryProvider";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* ===== HOTEL RATE MONITOR - DESIGN SYSTEM ===== */
export const metadata: Metadata = {
  title: "Hotel Rate Sentinel",
  description: "B2B Hotel Competitive Rate Monitor",
};

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${inter.variable} antialiased`}>
        <I18nProvider>
          <QueryProvider>
            <ToastProvider>
              <ModalProvider>
                <DashboardLayout>{children}</DashboardLayout>
              </ModalProvider>
            </ToastProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
