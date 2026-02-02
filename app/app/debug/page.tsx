'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { isDemoMode, DEMO_EMPLOYEES, DEMO_ORG_UNITS, DEMO_SKILLS, DEMO_POSITIONS } from '@/lib/demoData';
import { subscribe, getState, setFlag, clearErrors, type DebugState, type DebugError } from '@/lib/debugStore';
import { safeCount } from '@/lib/supabaseSafe';
import { 
  Bug, 
  Copy, 
  Check, 
  Database, 
  User, 
  Building2, 
  AlertTriangle,
  RefreshCw,
  Loader2,
  Shield,
  Trash2,
  Radio,
  Clock,
  Search,
  Wrench,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Counts {
  employees: number | 'denied' | null;
  units: number | 'denied' | null;
  skills: number | 'denied' | null;
  positions: number | 'denied' | null;
}

interface SchemaCheckResult {
  tables: Record<string, { exists: boolean; hasOrgId: boolean; rlsEnabled: boolean | null }>;
  nullOrgIdCounts: Record<string, number>;
  errors: string[];
}

export default function DebugPage() {
  const router = useRouter();
  const { currentOrg, currentRole, memberships, isLoading: orgLoading, error: orgError } = useOrg();
  const { user: authUser, isAuthenticated } = useAuth();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      router.replace("/app");
    }
  }, [router]);

  const [counts, setCounts] = useState<Counts>({ employees: null, units: null, skills: null, positions: null });
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [copied, setCopied] = useState(false);
  const [debugState, setDebugState] = useState<DebugState>(getState());
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [schemaCheck, setSchemaCheck] = useState<SchemaCheckResult | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [linkingEmployee, setLinkingEmployee] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      setDebugState(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (orgLoading) {
      setLoadingStartTime(Date.now());
    } else {
      setLoadingStartTime(null);
      setFlag('loadingTimeout', false);
    }
  }, [orgLoading]);

  useEffect(() => {
    if (!loadingStartTime) return;
    
    const timeoutId = setTimeout(() => {
      if (orgLoading) {
        setFlag('loadingTimeout', true);
      }
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, [loadingStartTime, orgLoading]);

  useEffect(() => {
    setFlag('orgMissing', !currentOrg && !orgLoading);
  }, [currentOrg, orgLoading]);

  const fetchCounts = useCallback(async () => {
    if (isDemoMode()) {
      setCounts({
        employees: DEMO_EMPLOYEES.length,
        units: DEMO_ORG_UNITS.length,
        skills: DEMO_SKILLS.length,
        positions: DEMO_POSITIONS.length,
      });
      return;
    }

    if (!currentOrg) {
      setCounts({ employees: null, units: null, skills: null, positions: null });
      return;
    }
    
    setLoadingCounts(true);
    try {
      const [employeesCount, unitsCount, skillsCount, positionsCount] = await Promise.all([
        safeCount(
          async () => await supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('is_active', true),
          'employees'
        ),
        safeCount(
          async () => await supabase.from('org_units').select('id', { count: 'exact', head: true }).eq('org_id', currentOrg.id),
          'org_units'
        ),
        safeCount(
          async () => await supabase.from('competences').select('id', { count: 'exact', head: true }),
          'competences (global)'
        ),
        safeCount(
          async () => await supabase.from('positions').select('id', { count: 'exact', head: true }),
          'positions (global)'
        ),
      ]);

      setCounts({
        employees: employeesCount,
        units: unitsCount,
        skills: skillsCount,
        positions: positionsCount,
      });
    } catch (err) {
      console.error('Error fetching counts:', err);
    } finally {
      setLoadingCounts(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const runSchemaCheck = useCallback(async () => {
    if (!currentOrg || isDemoMode()) return;
    
    setLoadingSchema(true);
    setSchemaCheck(null);
    
    try {
      const result = await apiGet<SchemaCheckResult>(`/api/debug/schema?orgId=${currentOrg.id}`);
      setSchemaCheck(result);
    } catch (err) {
      console.error('Schema check error:', err);
    } finally {
      setLoadingSchema(false);
    }
  }, [currentOrg]);

  const handleRepair = async (table: string, dryRun: boolean) => {
    if (!currentOrg) return;
    
    setRepairing(true);
    setRepairResult(null);
    
    try {
      const result = await apiPost<{ message: string; updatedCount?: number; nullCount?: number }>('/api/debug/repair-orgid', {
        orgId: currentOrg.id,
        table,
        dryRun,
      });
      setRepairResult(result.message);
      if (!dryRun) {
        await runSchemaCheck();
        await fetchCounts();
      }
    } catch (err) {
      setRepairResult(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setRepairing(false);
    }
  };

  const handleLinkEmployee = async () => {
    setLinkingEmployee(true);
    setLinkResult(null);
    
    try {
      const result = await apiPost<{ message: string; employeeId?: string; employeeName?: string; error?: string }>('/api/debug/link-employee', {});
      setLinkResult(result.message || result.error || 'Success');
      // Refresh page after successful link to reload user data
      if (result.message && !result.error) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setLinkResult(err instanceof Error ? err.message : 'Failed to link employee');
    } finally {
      setLinkingEmployee(false);
    }
  };

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
      flags: debugState.flags,
      errors: debugState.errors.slice(0, 10),
      lastApiCalls: debugState.lastApiCalls,
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

  const formatCountValue = (value: number | 'denied' | null): string => {
    if (value === 'denied') return 'Denied';
    if (value === null) return '-';
    return String(value);
  };

  const hasWarnings = debugState.flags.orgMissing || debugState.flags.rlsBlocked || debugState.flags.loadingTimeout || !currentRole;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Bug className="w-6 h-6" />
            Debug Cockpit
            <span className="ml-2 flex items-center gap-1 text-sm font-normal text-green-600">
              <Radio className="w-3 h-3 animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            System state and diagnostics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => clearErrors()} data-testid="button-clear-errors">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Errors
          </Button>
          <Button onClick={handleCopy} data-testid="button-copy-report">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Debug Report'}
          </Button>
        </div>
      </div>

      {hasWarnings && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-2">
          <p className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            System Warnings
          </p>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 ml-7">
            {debugState.flags.orgMissing && <li>No organization selected</li>}
            {!currentRole && currentOrg && <li>Current role is null (permissions issue)</li>}
            {debugState.flags.rlsBlocked && <li>RLS (Row Level Security) blocked some queries</li>}
            {debugState.flags.loadingTimeout && <li>Organization loading took longer than 5 seconds</li>}
          </ul>
        </div>
      )}

      {isDemoMode() && (
        <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Demo mode is active. Counts reflect demo data, not database.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            System Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className={`text-lg font-semibold ${debugState.flags.rlsBlocked ? 'text-red-600' : 'text-green-600'}`}>
                {debugState.flags.rlsBlocked ? 'YES' : 'NO'}
              </div>
              <div className="text-xs text-muted-foreground">RLS Blocked</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className={`text-lg font-semibold ${debugState.flags.orgMissing ? 'text-red-600' : 'text-green-600'}`}>
                {debugState.flags.orgMissing ? 'YES' : 'NO'}
              </div>
              <div className="text-xs text-muted-foreground">Org Missing</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className={`text-lg font-semibold ${debugState.flags.loadingTimeout ? 'text-red-600' : 'text-green-600'}`}>
                {debugState.flags.loadingTimeout ? 'YES' : 'NO'}
              </div>
              <div className="text-xs text-muted-foreground">Loading Timeout</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className={`text-lg font-semibold ${isDemoMode() ? 'text-amber-600' : 'text-foreground'}`}>
                {isDemoMode() ? 'YES' : 'NO'}
              </div>
              <div className="text-xs text-muted-foreground">Demo Mode</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
            {!isDemoMode() && currentOrg && (currentRole === 'admin' || currentRole === 'hr' || process.env.NODE_ENV !== 'production') && (
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLinkEmployee}
                  disabled={linkingEmployee}
                  className="w-full"
                  data-testid="button-link-employee"
                >
                  {linkingEmployee ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3 mr-2" />
                      Link my user to an employee
                    </>
                  )}
                </Button>
                {linkResult && (
                  <p className={`text-xs mt-2 ${
                    linkResult.includes('error') || linkResult.includes('Error') || linkResult.includes('Failed')
                      ? 'text-destructive'
                      : 'text-green-600'
                  }`}>
                    {linkResult}
                  </p>
                )}
              </div>
            )}
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
              <span className={`capitalize ${currentRole ? 'text-foreground' : 'text-red-600'}`}>
                {currentRole || 'null (!)'}
              </span>
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
            Data Counts {isDemoMode() ? '(Demo)' : currentOrg ? '(Org-scoped)' : ''}
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
              { label: 'Skills (Global)', value: counts.skills },
              { label: 'Positions (Global)', value: counts.positions },
            ].map(item => (
              <div key={item.label} className="text-center p-3 rounded-md bg-muted/50">
                <div className={`text-2xl font-semibold ${item.value === 'denied' ? 'text-red-600' : 'text-foreground'}`}>
                  {formatCountValue(item.value)}
                </div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!isDemoMode() && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4" />
              Schema Check
            </CardTitle>
            <Button variant="outline" size="sm" onClick={runSchemaCheck} disabled={loadingSchema || !currentOrg}>
              {loadingSchema ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Run Check</span>
            </Button>
          </CardHeader>
          <CardContent>
            {!schemaCheck ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Click "Run Check" to validate database schema and RLS
              </p>
            ) : (
              <div className="space-y-4">
                {schemaCheck.errors.length > 0 && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                    {schemaCheck.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">{e}</p>
                    ))}
                  </div>
                )}
                
                <div className="grid gap-2">
                  {Object.entries(schemaCheck.tables).map(([table, info]) => (
                    <div key={table} className="p-3 rounded-md bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{table}</span>
                        <div className="flex items-center gap-2">
                          {info.exists ? (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Exists
                            </span>
                          ) : (
                            <span className="text-xs text-red-600 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Missing
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={info.hasOrgId ? 'text-green-600' : 'text-red-600'}>
                          org_id: {info.hasOrgId ? 'Yes' : 'No'}
                        </span>
                        <span className={info.rlsEnabled === true ? 'text-green-600' : info.rlsEnabled === false ? 'text-red-600' : 'text-muted-foreground'}>
                          RLS: {info.rlsEnabled === true ? 'Enabled' : info.rlsEnabled === false ? 'Disabled' : 'Unknown'}
                        </span>
                        {schemaCheck.nullOrgIdCounts[table] !== undefined && (
                          <span className={schemaCheck.nullOrgIdCounts[table] > 0 ? 'text-amber-600' : 'text-green-600'}>
                            Null org_id: {schemaCheck.nullOrgIdCounts[table]}
                          </span>
                        )}
                      </div>
                      
                      {schemaCheck.nullOrgIdCounts[table] > 0 && (
                        <div className="pt-2 border-t border-border flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleRepair(table, true)}
                            disabled={repairing}
                          >
                            <Wrench className="w-3 h-3 mr-1" />
                            Preview Repair
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => {
                              if (confirm(`This will update all ${schemaCheck.nullOrgIdCounts[table]} rows with null org_id to the current org. Continue?`)) {
                                handleRepair(table, false);
                              }
                            }}
                            disabled={repairing}
                          >
                            {repairing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wrench className="w-3 h-3 mr-1" />}
                            Apply Repair
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {repairResult && (
                  <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">{repairResult}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {debugState.lastApiCalls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last API Calls ({debugState.lastApiCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {debugState.lastApiCalls.map((call, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                    call.status >= 200 && call.status < 300 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {call.status}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                    {call.endpoint}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(call.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Recent Errors ({debugState.errors.length})
            <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse text-green-500" />
              Auto-updating
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {debugState.errors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No errors logged in this session
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {debugState.errors.map((error, idx) => (
                <div key={idx} className="p-3 rounded-md bg-destructive/5 border border-destructive/20 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs uppercase ${
                      error.type === 'supabase' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : error.type === 'client'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(error.timestamp).toLocaleString()}
                  </p>
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
