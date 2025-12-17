'use client';

import { ReactNode } from 'react';
import { OrgContext, useOrgState } from '@/hooks/useOrg';

interface OrgProviderProps {
  children: ReactNode;
}

export function OrgProvider({ children }: OrgProviderProps) {
  const orgState = useOrgState();

  return (
    <OrgContext.Provider value={orgState}>
      {children}
    </OrgContext.Provider>
  );
}
