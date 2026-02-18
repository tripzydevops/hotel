/**
 * EXPLANATION: Landing Route Group Layout
 * 
 * This layout wraps ALL public marketing pages (/, /about, /pricing, /contact)
 * with the LandingNavbar and LandingFooter.
 * 
 * Uses a Next.js route group "(landing)" so these pages share the
 * marketing layout without affecting the URL structure.
 * The dashboard pages use a separate "(dashboard)" route group
 * with their own DashboardLayout (sidebar + header).
 */
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen">{children}</main>
      <LandingFooter />
    </>
  );
}
