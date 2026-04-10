/**
 * Dashboard Layout Wrapper
 * Wraps protected dashboard pages with shared layout components.
 */
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
