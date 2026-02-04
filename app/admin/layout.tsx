"use client";

import { useAdminGuard } from "@/hooks/useAdminGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--soft-gold)]"></div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Hook handles redirect
  }

  return <>{children}</>;
}
