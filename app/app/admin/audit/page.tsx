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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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

function AdminAuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrg } = useOrg();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<FocusedEvent | null>(null);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const focusFetchedRef = useRef<string | null>(null);

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

      {selectedEvent && (
        <div className="rounded-lg border border-primary/30 bg-muted/50 dark:bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-foreground">Focused Event</span>
            <Button type="button" variant="outline" size="sm" onClick={clearFocus}>
              Clear focus
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span><strong className="text-foreground">Action:</strong> {selectedEvent.action}</span>
            <span><strong className="text-foreground">Target:</strong> {selectedEvent.target_type}{selectedEvent.target_id ? ` / ${selectedEvent.target_id}` : ''}</span>
            <span><strong className="text-foreground">Actor:</strong> {selectedEvent.actor_email ?? selectedEvent.created_by ?? '—'}</span>
            <span><strong className="text-foreground">Created:</strong> {formatDate(selectedEvent.created_at)}</span>
          </div>
        </div>
      )}

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
          {logs.map((log) => {
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
