/**
 * EXPLANATION: Dashboard Route Group Layout
 * 
 * This layout wraps ALL protected dashboard pages (/, /admin, /analysis, etc.)
 * with the DashboardLayout component (sidebar + header).
 * 
 * By using a Next.js route group "(dashboard)", these pages share the
 * DashboardLayout without affecting the URL structure.
 * The landing/marketing pages use a separate "(landing)" route group
 * with their own layout (LandingLayout).
 */
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
