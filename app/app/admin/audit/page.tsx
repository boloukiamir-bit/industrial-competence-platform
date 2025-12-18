'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { OrgGuard } from '@/components/OrgGuard';
import { supabase } from '@/lib/supabaseClient';
import { DataState, useDataState } from '@/components/DataState';
import { logDebugError } from '@/app/app/debug/page';
import { 
  ScrollText, 
  Filter,
  User,
  Building2,
  UserPlus,
  Shield,
  UserX
} from 'lucide-react';

interface AuditLog {
  id: number;
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
  const { currentOrg } = useOrg();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    if (!currentOrg) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError({ message: 'Not authenticated', code: 'AUTH_REQUIRED' });
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/admin/audit?orgId=${currentOrg.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        const apiError = {
          message: data.message || data.error || 'Failed to load audit logs',
          code: data.code,
          hint: data.hint,
        };
        setError(apiError);
        logDebugError?.({
          timestamp: new Date().toISOString(),
          type: 'api',
          endpoint: '/api/admin/audit',
          status: res.status,
          ...apiError,
        });
      } else {
        let filteredLogs = data.logs || [];
        if (actionFilter) {
          filteredLogs = filteredLogs.filter((l: AuditLog) => l.action === actionFilter);
        }
        setLogs(filteredLogs);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      const apiError = { 
        message: err instanceof Error ? err.message : 'Failed to load audit logs',
        code: 'NETWORK_ERROR'
      };
      setError(apiError);
      logDebugError?.({
        timestamp: new Date().toISOString(),
        type: 'api',
        endpoint: '/api/admin/audit',
        ...apiError,
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrg, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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
            
            return (
              <div 
                key={log.id} 
                className="p-4 rounded-lg border border-border bg-card flex items-start gap-4"
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
