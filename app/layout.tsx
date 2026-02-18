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

/**
 * EXPLANATION: Root Layout (Minimal Shell)
 * 
 * This root layout provides only the base HTML shell with fonts and providers.
 * It does NOT include DashboardLayout — that's now in (dashboard)/layout.tsx.
 * This allows the (landing) route group to use its own marketing layout
 * while the (dashboard) route group uses the sidebar/header layout.
 */
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
                {children}
              </ModalProvider>
            </ToastProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
