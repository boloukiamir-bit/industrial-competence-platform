'use client';

import { useState, useEffect } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { isDemoMode } from '@/lib/demoData';
import { 
  Bug, 
  Copy, 
  Check, 
  Database, 
  User, 
  Building2, 
  AlertTriangle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DebugError {
  timestamp: string;
  type: 'api' | 'supabase';
  endpoint?: string;
  status?: number;
  code?: string;
  message: string;
  hint?: string;
}

interface Counts {
  employees: number | null;
  units: number | null;
  skills: number | null;
  positions: number | null;
}

const errorLog: DebugError[] = [];

export function logDebugError(error: DebugError) {
  errorLog.unshift(error);
  if (errorLog.length > 10) errorLog.pop();
}

if (typeof window !== 'undefined') {
  (window as unknown as { logDebugError: typeof logDebugError }).logDebugError = logDebugError;
}

export default function DebugPage() {
  const { currentOrg, currentRole, memberships, isLoading: orgLoading, error: orgError } = useOrg();
  const { user: authUser, isAuthenticated } = useAuth();
  const [counts, setCounts] = useState<Counts>({ employees: null, units: null, skills: null, positions: null });
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<DebugError[]>([]);

  useEffect(() => {
    setErrors([...errorLog]);
  }, []);

  const fetchCounts = async () => {
    if (!currentOrg) return;
    
    setLoadingCounts(true);
    try {
      const [employeesRes, unitsRes, skillsRes, positionsRes] = await Promise.allSettled([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', currentOrg.id),
        supabase.from('org_units').select('id', { count: 'exact', head: true }).eq('org_id', currentOrg.id),
        supabase.from('competences').select('id', { count: 'exact', head: true }),
        supabase.from('positions').select('id', { count: 'exact', head: true }),
      ]);

      setCounts({
        employees: employeesRes.status === 'fulfilled' ? employeesRes.value.count : null,
        units: unitsRes.status === 'fulfilled' ? unitsRes.value.count : null,
        skills: skillsRes.status === 'fulfilled' ? skillsRes.value.count : null,
        positions: positionsRes.status === 'fulfilled' ? positionsRes.value.count : null,
      });
    } catch (err) {
      console.error('Error fetching counts:', err);
    } finally {
      setLoadingCounts(false);
    }
  };

  useEffect(() => {
    if (currentOrg) {
      fetchCounts();
    }
  }, [currentOrg]);

  const getOrgSource = () => {
    if (!currentOrg) return 'none';
    const stored = typeof window !== 'undefined' ? localStorage.getItem('nadiplan_current_org') : null;
    if (stored === currentOrg.id) return 'localStorage';
    if (memberships.length === 1) return 'auto-selected (single org)';
    return 'selected';
  };

  const generateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      demoMode: isDemoMode(),
      user: {
        email: authUser?.email || 'not authenticated',
        id: authUser?.id || null,
        authenticated: isAuthenticated,
      },
      organization: {
        id: currentOrg?.id || null,
        name: currentOrg?.name || null,
        slug: currentOrg?.slug || null,
        source: getOrgSource(),
        role: currentRole,
      },
      memberships: memberships.map(m => ({
        orgId: m.org_id,
        orgName: m.organization?.name,
        role: m.role,
        status: m.status,
      })),
      counts,
      errors: errors.slice(0, 10),
      orgLoadingState: {
        isLoading: orgLoading,
        error: orgError,
      },
    };
    return JSON.stringify(report, null, 2);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Bug className="w-6 h-6" />
            Debug Cockpit
          </h1>
          <p className="text-muted-foreground mt-1">
            System state and diagnostics
          </p>
        </div>
        <Button onClick={handleCopy} data-testid="button-copy-report">
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy Debug Report'}
        </Button>
      </div>

      {isDemoMode() && (
        <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Demo mode is active. Database queries return mock data.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Current User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-mono text-foreground" data-testid="text-user-email">
                {authUser?.email || 'Not authenticated'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono text-foreground text-xs truncate max-w-[200px]">
                {authUser?.id || '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Authenticated:</span>
              <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                {isAuthenticated ? 'Yes' : 'No'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Current Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium text-foreground" data-testid="text-org-name">
                {currentOrg?.name || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Org ID:</span>
              <span className="font-mono text-foreground text-xs truncate max-w-[200px]" data-testid="text-org-id">
                {currentOrg?.id || '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Source:</span>
              <span className="text-foreground">{getOrgSource()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role:</span>
              <span className="capitalize text-foreground">{currentRole || '-'}</span>
            </div>
            {orgLoading && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading org...
              </div>
            )}
            {orgError && (
              <div className="text-sm text-destructive">{orgError}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Counts
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchCounts} disabled={loadingCounts}>
            <RefreshCw className={`w-4 h-4 ${loadingCounts ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Employees', value: counts.employees },
              { label: 'Org Units', value: counts.units },
              { label: 'Competences', value: counts.skills },
              { label: 'Positions', value: counts.positions },
            ].map(item => (
              <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                <div className="text-2xl font-semibold text-foreground">
                  {item.value === null ? '-' : item.value}
                </div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Recent Errors (Last 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No errors logged in this session
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {errors.map((error, idx) => (
                <div key={idx} className="p-3 rounded-md bg-destructive/5 border border-destructive/20 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-xs bg-destructive/10 text-destructive uppercase">
                      {error.type}
                    </span>
                    {error.endpoint && (
                      <span className="font-mono text-xs text-muted-foreground">{error.endpoint}</span>
                    )}
                    {error.status && (
                      <span className="text-xs text-muted-foreground">Status: {error.status}</span>
                    )}
                  </div>
                  <p className="text-foreground">{error.message}</p>
                  {error.code && (
                    <p className="text-xs text-muted-foreground mt-1">Code: {error.code}</p>
                  )}
                  {error.hint && (
                    <p className="text-xs text-muted-foreground">Hint: {error.hint}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{error.timestamp}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No organization memberships found
            </p>
          ) : (
            <div className="space-y-2">
              {memberships.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-md border ${
                    m.org_id === currentOrg?.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {m.organization?.name || m.org_id}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground capitalize">
                      {m.role}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {m.org_id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
