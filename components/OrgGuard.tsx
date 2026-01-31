'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';

interface OrgGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
  /** When true, allow admin or hr (for master-data, audit, etc.). */
  requireAdminOrHr?: boolean;
}

export function OrgGuard({ children, requireAdmin = false, requireAdminOrHr = false }: OrgGuardProps) {
  const { currentOrg, isLoading, memberships, isAdmin, isAdminOrHr } = useOrg();
  const router = useRouter();
  const allowed = requireAdminOrHr ? isAdminOrHr : requireAdmin ? isAdmin : true;

  useEffect(() => {
    if (isLoading) return;

    // If no org selected and user has memberships, redirect to org select
    if (!currentOrg && memberships.length > 0) {
      router.replace('/app/org/select');
      return;
    }

    // If no memberships at all, user needs to create or join an org
    if (!currentOrg && memberships.length === 0) {
      router.replace('/app/org/select');
      return;
    }

    // If admin (or admin/hr) required but user not allowed
    if ((requireAdmin || requireAdminOrHr) && !allowed) {
      router.replace('/app');
      return;
    }
  }, [currentOrg, isLoading, memberships, allowed, requireAdmin, requireAdminOrHr, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!currentOrg) {
    return null;
  }

  if ((requireAdmin || requireAdminOrHr) && !allowed) {
    return null;
  }

  return <>{children}</>;
}
