'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';

interface OrgGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function OrgGuard({ children, requireAdmin = false }: OrgGuardProps) {
  const { currentOrg, isLoading, memberships, isAdmin } = useOrg();
  const router = useRouter();

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

    // If admin required but user is not admin
    if (requireAdmin && !isAdmin) {
      router.replace('/app');
      return;
    }
  }, [currentOrg, isLoading, memberships, isAdmin, requireAdmin, router]);

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

  if (requireAdmin && !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
