'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Membership {
  org_id: string;
  user_id: string;
  role: 'admin' | 'hr' | 'manager' | 'user';
  status: 'active' | 'disabled';
  created_at: string;
  organization?: Organization;
}

interface OrgContextType {
  currentOrg: Organization | null;
  currentRole: Membership['role'] | null;
  memberships: Membership[];
  isLoading: boolean;
  error: string | null;
  selectOrg: (orgId: string) => void;
  refreshMemberships: () => Promise<void>;
  isAdmin: boolean;
  isAdminOrHr: boolean;
}

const ORG_STORAGE_KEY = 'nadiplan_current_org';

export function useOrgState() {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<Membership['role'] | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMemberships = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMemberships([]);
        setCurrentOrg(null);
        setCurrentRole(null);
        setIsLoading(false);
        return;
      }

      // Get all active memberships with org details
      const { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select(`
          org_id,
          user_id,
          role,
          status,
          created_at,
          organization:organizations(id, name, slug, created_at)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (membershipError) {
        console.error('Error fetching memberships:', membershipError);
        setError('Failed to load organizations');
        setIsLoading(false);
        return;
      }

      const formattedMemberships: Membership[] = (membershipData || []).map((m: {
        org_id: string;
        user_id: string;
        role: 'admin' | 'hr' | 'manager' | 'user';
        status: 'active' | 'disabled';
        created_at: string;
        organization: Organization | Organization[] | null;
      }) => ({
        ...m,
        organization: Array.isArray(m.organization) ? m.organization[0] : (m.organization || undefined),
      }));

      setMemberships(formattedMemberships);

      // Try to restore previously selected org
      const storedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
      let activeOrgId: string | null = null;
      if (storedOrgId) {
        const membership = formattedMemberships.find(m => m.org_id === storedOrgId);
        if (membership && membership.organization) {
          setCurrentOrg(membership.organization);
          setCurrentRole(membership.role);
          activeOrgId = membership.org_id;
        } else if (formattedMemberships.length === 1 && formattedMemberships[0].organization) {
          setCurrentOrg(formattedMemberships[0].organization);
          setCurrentRole(formattedMemberships[0].role);
          localStorage.setItem(ORG_STORAGE_KEY, formattedMemberships[0].org_id);
          activeOrgId = formattedMemberships[0].org_id;
        }
      } else if (formattedMemberships.length === 1 && formattedMemberships[0].organization) {
        setCurrentOrg(formattedMemberships[0].organization);
        setCurrentRole(formattedMemberships[0].role);
        localStorage.setItem(ORG_STORAGE_KEY, formattedMemberships[0].org_id);
        activeOrgId = formattedMemberships[0].org_id;
      }
      if (activeOrgId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch('/api/me/active-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ org_id: activeOrgId }),
            credentials: 'include',
          }).catch((e) => console.error('Failed to sync active org', e));
        }
      }
    } catch (err) {
      console.error('Error in refreshMemberships:', err);
      setError('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncActiveOrgToSession = useCallback(async (orgId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch('/api/me/active-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ org_id: orgId }),
        credentials: 'include',
      });
    } catch (e) {
      console.error('Failed to sync active org to session', e);
    }
  }, []);

  const selectOrg = useCallback((orgId: string) => {
    const membership = memberships.find(m => m.org_id === orgId);
    if (membership && membership.organization) {
      setCurrentOrg(membership.organization);
      setCurrentRole(membership.role);
      localStorage.setItem(ORG_STORAGE_KEY, orgId);
      syncActiveOrgToSession(orgId);
    }
  }, [memberships, syncActiveOrgToSession]);

  useEffect(() => {
    refreshMemberships();
  }, [refreshMemberships]);

  return {
    currentOrg,
    currentRole,
    memberships,
    isLoading,
    error,
    selectOrg,
    refreshMemberships,
    isAdmin: currentRole === 'admin',
    isAdminOrHr: currentRole === 'admin' || currentRole === 'hr',
  };
}

export const OrgContext = createContext<OrgContextType | null>(null);

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
