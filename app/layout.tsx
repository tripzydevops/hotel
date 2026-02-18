/**
 * EXPLANATION: Root Application Layout
 * 
 * The entry point for the entire application. Configures global fonts,
 * metadata, and context providers (I18n, Theme, Query, Toast, Modal).
 * Sets the foundational structure for all route groups.
 */
import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${inter.variable} antialiased`}>
        <I18nProvider>
          <ThemeProvider>
            <QueryProvider>
              <ToastProvider>
                <ModalProvider>
                  {children}
                </ModalProvider>
              </ToastProvider>
            </QueryProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
