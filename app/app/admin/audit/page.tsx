'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { OrgGuard } from '@/components/OrgGuard';
import { DataState, useDataState } from '@/components/DataState';
import { apiGet } from '@/lib/apiClient';
import {
  ScrollText,
  Filter,
  User,
  Building2,
  UserPlus,
  Shield,
  UserX,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Single governance event from GET /api/admin/audit/event */
interface FocusedEvent {
  id: string;
  org_id: string;
  site_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  actor_email: string | null;
}

interface AuditLog {
  id: number | string;
  actor_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_email?: string | null;
}

interface ApiError {
  message: string;
  code?: string;
  hint?: string;
}

const ACTION_ICONS: Record<string, typeof Building2> = {
  'org.created': Building2,
  'user.invited': UserPlus,
  'membership.role_updated': Shield,
  'membership.disabled': UserX,
};

const ACTION_LABELS: Record<string, string> = {
  'org.created': 'Organization Created',
  'user.invited': 'User Invited',
  'membership.role_updated': 'Role Changed',
  'membership.disabled': 'User Disabled',
};

const FOCUSED_EVENT_TIMEZONE = 'Europe/Stockholm';

/** Single helper for focused event timestamp: ISO UTC + local (Europe/Stockholm). */
function formatFocusedEventTimestamp(isoDateStr: string): { isoUtc: string; localStockholm: string } {
  const d = new Date(isoDateStr);
  const isoUtc = d.toISOString();
  const localStockholm = d.toLocaleString('sv-SE', {
    timeZone: FOCUSED_EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return { isoUtc, localStockholm };
}

type GovernanceEventCategory = 'REGULATORY' | 'EXECUTION' | 'COMPLIANCE' | 'LEGITIMACY' | 'SYSTEM';

/** Deterministic classification for governance events. Priority: REGULATORY > LEGITIMACY > COMPLIANCE > EXECUTION > SYSTEM. */
function classifyGovernanceEvent(action?: string | null, targetType?: string | null): GovernanceEventCategory {
  const a = (action ?? '').toUpperCase();
  const t = (targetType ?? '').toLowerCase();

  if (a.startsWith('REGULATORY_') || t === 'regulatory_signal') return 'REGULATORY';
  if (a.includes('LEGITIMACY') || a.startsWith('GOVERNANCE_GATE_') || a === 'ALLOWED' || a === 'BLOCKED') return 'LEGITIMACY';
  if (a.startsWith('COMPLIANCE_') || t.includes('compliance')) return 'COMPLIANCE';
  if (a.includes('DECISION') || a.startsWith('COCKPIT_') || a.startsWith('TOMORROWS_GAPS_')) return 'EXECUTION';
  return 'SYSTEM';
}

type GovernanceEventSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Deterministic severity from category + action. Priority: CRITICAL > HIGH > MEDIUM > LOW > INFO. Does not inspect meta. */
function resolveGovernanceSeverity(
  category: GovernanceEventCategory,
  action?: string | null,
  targetType?: string | null,
  _meta?: unknown
): GovernanceEventSeverity {
  const a = (action ?? '').toUpperCase();
  void targetType; // reserved for future use

  if (category === 'LEGITIMACY' && (a === 'BLOCKED' || a.includes('LEGAL_STOP') || a.includes('NO_GO'))) return 'CRITICAL';
  if (category === 'REGULATORY' && a.includes('BLOCKED')) return 'CRITICAL';
  if (category === 'REGULATORY' || category === 'LEGITIMACY') return 'HIGH';
  if (category === 'COMPLIANCE') return 'MEDIUM';
  if (category === 'EXECUTION') return 'LOW';
  if (category === 'SYSTEM') return 'INFO';
  return 'INFO';
}

type GovernanceEventImpact = 'BLOCKING' | 'NON-BLOCKING';

function resolveGovernanceImpact(sev: GovernanceEventSeverity): GovernanceEventImpact {
  return sev === 'CRITICAL' || sev === 'HIGH' ? 'BLOCKING' : 'NON-BLOCKING';
}

/** Safe created_at as timestamp; 0 if missing or invalid. */
function safeCreatedAtTime(created_at: string | undefined | null): number {
  if (created_at == null || created_at === '') return 0;
  const t = new Date(created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Deterministic field order for regulatory_signal meta payload. */
const REGULATORY_SIGNAL_PAYLOAD_KEYS = [
  'signal_id',
  'impact_level',
  'effective_date',
  'relevance_score',
  'source',
  'source_url',
  'source_name',
  'summary',
  'title',
  'time_to_impact_days',
] as const;

function formatPayloadValue(key: string, value: unknown): string {
  if (value == null) return '';
  if (key === 'effective_date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Minimal drilldown: shows snapshot id and fetches/renders snapshot on "View snapshot". */
function ReadinessSnapshotBlock({ snapshotId }: { snapshotId: string }) {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setSnapshot(null);
    try {
      const data = await apiGet<{ ok: boolean; snapshot?: Record<string, unknown>; error?: string }>(
        `/api/readiness/snapshots/${encodeURIComponent(snapshotId)}`
      );
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        setErr(data.error ?? 'Not found');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground text-sm">Readiness Snapshot</span>
        <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{snapshotId}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadSnapshot}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'View snapshot'}
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {snapshot != null && (
        <pre className="p-3 rounded-md bg-muted text-muted-foreground text-xs overflow-x-auto">
          <code>{JSON.stringify(snapshot, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}

function PayloadSection({
  meta,
  targetType,
  defaultOpen = false,
}: {
  meta: Record<string, unknown>;
  targetType: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isEmpty = !meta || Object.keys(meta).length === 0;

  if (isEmpty) return null;

  const isRegulatorySignal = targetType === 'regulatory_signal';

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>Payload</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isRegulatorySignal ? (
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {REGULATORY_SIGNAL_PAYLOAD_KEYS.map((key) => {
              const value = meta[key];
              if (value === undefined || value === null) return null;
              return (
                <span key={key} className="contents">
                  <span className="text-muted-foreground font-medium">{key.replace(/_/g, ' ')}</span>
                  <span className="text-foreground break-all">{formatPayloadValue(key, value)}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <pre className="mt-2 p-3 rounded-md bg-muted text-muted-foreground text-xs overflow-x-auto">
            <code>{JSON.stringify(meta, null, 2)}</code>
          </pre>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AdminAuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrg } = useOrg();
  const { toast, toasts } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<FocusedEvent | null>(null);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const focusFetchedRef = useRef<string | null>(null);

  const copyEventId = useCallback(() => {
    if (!selectedEvent?.id) return;
    navigator.clipboard.writeText(selectedEvent.id).then(
      () => toast({ title: 'Copied' }),
      () => toast({ title: 'Copy failed', variant: 'destructive' })
    );
  }, [selectedEvent?.id, toast]);

  const fetchLogs = useCallback(async () => {
    if (!currentOrg) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiGet<{ logs: AuditLog[] }>('/api/admin/audit');
      let filteredLogs = data.logs || [];
      if (actionFilter) {
        filteredLogs = filteredLogs.filter((l: AuditLog) => l.action === actionFilter);
      }
      setLogs(filteredLogs);
    } catch (err) {
      console.error('Fetch error:', err);
      const apiError = {
        message: err instanceof Error ? err.message : 'Failed to load audit logs',
        code: 'NETWORK_ERROR',
      };
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const idParam = searchParams.get('id')?.trim() ?? '';
  const impactParam = searchParams.get('impact')?.trim() ?? '';
  const windowHoursParam = searchParams.get('window_hours');
  const windowHours = (() => {
    const n = Number(windowHoursParam);
    return Number.isFinite(n) && n >= 1 && n <= 168 ? n : null;
  })();

  useEffect(() => {
    if (!idParam || !UUID_RE.test(idParam)) {
      if (!UUID_RE.test(idParam) && idParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete('id');
        router.replace(url.pathname + (url.search || ''));
      }
      setSelectedEvent(null);
      setFocusError(null);
      focusFetchedRef.current = null;
      return;
    }
    if (focusFetchedRef.current === idParam) return;
    focusFetchedRef.current = idParam;
    setFocusError(null);

    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ ok: boolean; event?: FocusedEvent; error?: string }>(
          `/api/admin/audit/event?id=${encodeURIComponent(idParam)}`
        );
        if (cancelled) return;
        if (data.ok && data.event) {
          setSelectedEvent(data.event);
        } else if (data.error === 'NOT_FOUND') {
          setFocusError('Event not found in this tenant.');
          setSelectedEvent(null);
          focusFetchedRef.current = null;
          const url = new URL(window.location.href);
          url.searchParams.delete('id');
          router.replace(url.pathname + (url.search || ''));
        } else if (data.error === 'INVALID_ID') {
          const url = new URL(window.location.href);
          url.searchParams.delete('id');
          router.replace(url.pathname + (url.search || ''));
          setSelectedEvent(null);
          focusFetchedRef.current = null;
        }
      } catch {
        if (!cancelled) {
          setFocusError('Event not found in this tenant.');
          setSelectedEvent(null);
          focusFetchedRef.current = null;
          const url = new URL(window.location.href);
          url.searchParams.delete('id');
          router.replace(url.pathname + (url.search || ''));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idParam, router]);

  useEffect(() => {
    if (!selectedEvent) return;
    const el = document.getElementById(`audit-${selectedEvent.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [selectedEvent?.id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMetadata = (metadata: Record<string, unknown>) => {
    const entries = Object.entries(metadata);
    if (entries.length === 0) return null;
    
    return entries.map(([key, value]) => (
      <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs mr-1">
        {key}: {String(value)}
      </span>
    ));
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const dataStatus = useDataState(logs, loading, error);

  const sortedLogs = [...logs].sort((a, b) => {
    const categoryA = classifyGovernanceEvent(a.action, a.target_type);
    const categoryB = classifyGovernanceEvent(b.action, b.target_type);
    const severityA = resolveGovernanceSeverity(categoryA, a.action, a.target_type, a.metadata);
    const severityB = resolveGovernanceSeverity(categoryB, b.action, b.target_type, b.metadata);
    const impactA = resolveGovernanceImpact(severityA);
    const impactB = resolveGovernanceImpact(severityB);
    const rankA = impactA === 'BLOCKING' ? 0 : 1;
    const rankB = impactB === 'BLOCKING' ? 0 : 1;
    const timeA = safeCreatedAtTime(a.created_at);
    const timeB = safeCreatedAtTime(b.created_at);
    return rankA - rankB || timeB - timeA || String(b.id).localeCompare(String(a.id));
  });

  let filteredLogs = sortedLogs;
  if (impactParam === 'blocking') {
    filteredLogs = filteredLogs.filter((log) => {
      const category = classifyGovernanceEvent(log.action, log.target_type);
      const severity = resolveGovernanceSeverity(category, log.action, log.target_type, log.metadata);
      return resolveGovernanceImpact(severity) === 'BLOCKING';
    });
  }
  if (windowHours != null) {
    const since = Date.now() - windowHours * 60 * 60 * 1000;
    filteredLogs = filteredLogs.filter((log) => safeCreatedAtTime(log.created_at) >= since);
  }

  const displayLogs: AuditLog[] =
    selectedEvent && !filteredLogs.some((l) => String(l.id) === selectedEvent.id)
      ? [
          {
            id: selectedEvent.id,
            actor_user_id: '',
            action: selectedEvent.action,
            target_type: selectedEvent.target_type,
            target_id: selectedEvent.target_id,
            metadata: selectedEvent.meta ?? {},
            created_at: selectedEvent.created_at,
            actor_email: selectedEvent.actor_email ?? null,
          },
          ...filteredLogs,
        ]
      : filteredLogs;

  const clearFocus = useCallback(() => {
    setSelectedEvent(null);
    setFocusError(null);
    focusFetchedRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    router.replace(url.pathname + (url.search || ''));
  }, [router]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {focusError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
          <span>{focusError}</span>
          <Button type="button" variant="ghost" size="sm" onClick={clearFocus} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {selectedEvent && (() => {
        const ts = formatFocusedEventTimestamp(selectedEvent.created_at);
        return (
        <div className="rounded-lg border border-primary/30 bg-muted/50 dark:bg-muted/30 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-foreground">Focused Event</span>
            <Button type="button" variant="outline" size="sm" onClick={clearFocus}>
              Clear focus
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">Event ID</span>
              <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{selectedEvent.id}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={copyEventId}
                aria-label="Copy event ID"
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </Button>
            </div>
            <div>
              {(() => {
                const category = classifyGovernanceEvent(selectedEvent.action, selectedEvent.target_type);
                const severity = resolveGovernanceSeverity(
                  category,
                  selectedEvent.action,
                  selectedEvent.target_type,
                  selectedEvent.meta
                );
                const impact = resolveGovernanceImpact(severity);
                const severityPillClass =
                  severity === 'CRITICAL' || severity === 'HIGH'
                    ? 'border-foreground/30 font-semibold text-foreground'
                    : severity === 'MEDIUM'
                      ? 'border-border text-muted-foreground'
                      : 'border-border text-muted-foreground';
                const impactPillClass =
                  impact === 'BLOCKING' ? 'border-foreground/30 font-semibold text-foreground' : 'border-border text-muted-foreground';
                return (
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-muted-foreground">Action</span>
                    <span className="inline-flex items-center rounded-full border bg-muted/80 px-2 py-0.5 text-xs font-medium uppercase border-border text-muted-foreground">
                      CATEGORY: {category}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border bg-muted/80 px-2 py-0.5 text-xs font-medium uppercase ${severityPillClass}`}
                    >
                      SEVERITY: {severity}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border bg-muted/80 px-2 py-0.5 text-xs font-medium uppercase ${impactPillClass}`}
                    >
                      IMPACT: {impact}
                    </span>
                  </div>
                );
              })()}
              <p className="font-semibold text-foreground mt-0.5">{selectedEvent.action}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Target</span>
              <p className="font-mono text-xs mt-0.5 text-foreground">
                {selectedEvent.target_type}
                {selectedEvent.target_id != null && selectedEvent.target_id !== ''
                  ? ` / ${selectedEvent.target_id}`
                  : ''}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Actor</span>
              <p className="mt-0.5 text-foreground">
                {selectedEvent.actor_email ?? selectedEvent.created_by ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Timestamp</span>
              <p className="mt-0.5 font-mono text-xs text-foreground">{ts.isoUtc}</p>
              <p className="mt-0.5 text-muted-foreground">
                {ts.localStockholm} ({FOCUSED_EVENT_TIMEZONE})
              </p>
            </div>
          </div>
          <PayloadSection
            meta={selectedEvent.meta ?? {}}
            targetType={selectedEvent.target_type}
            defaultOpen={selectedEvent.target_type === 'regulatory_signal'}
          />
          {selectedEvent.meta?.readiness_snapshot_id != null && (
            <ReadinessSnapshotBlock snapshotId={String(selectedEvent.meta.readiness_snapshot_id)} />
          )}
        </div>
        );
      })()}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Activity history for {currentOrg?.name}
          </p>
        </div>
        
        {dataStatus === 'ready' && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              data-testid="select-action-filter"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action] || action}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <DataState
        status={dataStatus}
        error={error}
        onRetry={fetchLogs}
        emptyTitle="No audit events yet"
        emptyMessage="Activity will appear here as users take actions in the organization."
        emptyIcon={<ScrollText className="w-8 h-8 text-muted-foreground" />}
      >
        <div className="space-y-2">
          {displayLogs.map((log) => {
            const IconComponent = ACTION_ICONS[log.action] || ScrollText;
            const isFocused = selectedEvent != null && String(log.id) === selectedEvent.id;
            const showFlash = isFocused && flash;
            return (
              <div
                key={log.id}
                id={`audit-${log.id}`}
                className={`p-4 rounded-lg border flex items-start gap-4 transition-colors ${
                  isFocused
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10'
                    : 'border-border bg-card'
                } ${showFlash ? 'animate-pulse' : ''}`}
                data-testid={`row-audit-${log.id}`}
              >
                <div className="p-2 rounded-md bg-muted">
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    {log.target_type && (
                      <span className="text-muted-foreground text-sm">
                        on {log.target_type}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{log.actor_email || 'System'}</span>
                    <span>at {formatDate(log.created_at)}</span>
                  </div>
                  
                  {Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2">
                      {formatMetadata(log.metadata)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DataState>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-4 py-3 shadow-lg ${
                t.variant === 'destructive'
                  ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/80'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              {t.title && <p className="font-medium text-sm">{t.title}</p>}
              {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <OrgGuard requireAdmin>
      <AdminAuditContent />
    </OrgGuard>
  );
}
