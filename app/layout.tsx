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

import ServiceWorkerProvider from "@/components/providers/ServiceWorkerProvider";
import { InsforgeProvider } from "./providers";

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
  title: "Hotel Rate Sentinel - Market Intelligence",
  description: "B2B Hotel Competitive Rate Monitor & Intelligence Platform for dynamic pricing.",
  openGraph: {
    title: "Hotel Rate Sentinel",
    description: "Track your competitors, monitor live pricing across global vendors, and receive instant market intelligence.",
    url: "https://tripzy.dev",
    siteName: "Hotel Rate Sentinel",
    images: [
      {
        url: "https://tripzy.dev/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hotel Rate Sentinel OpenGraph image",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hotel Rate Sentinel",
    description: "Monitor live hotel prices and competitor intelligence.",
    images: ["https://tripzy.dev/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Ensure we signal crawlers indexing this page
  keywords: ["hotel", "prices", "B2B", "monitor", "competitor analysis", "market intelligence"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Structured Data for AI Crawlers like SearchGPT, Perplexity
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Hotel Rate Sentinel",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "B2B Hotel Competitive Rate Monitor & Market Intelligence Platform.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${inter.variable} antialiased`}>
        {/* Inject JSON-LD to make the site fully understandable to AI Search indexers */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <InsforgeProvider>
          <I18nProvider>
            <ThemeProvider>
              <QueryProvider>
                <ToastProvider>
                  <ModalProvider>
                    <ServiceWorkerProvider>
                      {children}
                    </ServiceWorkerProvider>
                  </ModalProvider>
                </ToastProvider>
              </QueryProvider>
            </ThemeProvider>
          </I18nProvider>
        </InsforgeProvider>
      </body>
    </html>
  );
}
