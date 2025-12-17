'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { OrgGuard } from '@/components/OrgGuard';
import { supabase } from '@/lib/supabaseClient';
import { 
  ScrollText, 
  Loader2,
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
  actor_profile?: {
    email: string;
  };
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
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    if (!currentOrg) return;
    
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          id,
          actor_user_id,
          action,
          target_type,
          target_id,
          metadata,
          created_at,
          actor_profile:profiles!audit_logs_actor_user_id_fkey(email)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionFilter) {
        query = query.eq('action', actionFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching audit logs:', fetchError);
        setError('Failed to load audit logs');
      } else {
        const formattedLogs = (data || []).map((log: {
          id: number;
          actor_user_id: string;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          actor_profile: { email: string } | { email: string }[] | null;
        }) => ({
          ...log,
          actor_profile: Array.isArray(log.actor_profile) ? log.actor_profile[0] : (log.actor_profile || undefined),
        }));
        setLogs(formattedLogs as AuditLog[]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load audit logs');
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
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive" data-testid="text-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No audit logs found</p>
        </div>
      ) : (
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
                    <span>{log.actor_profile?.email || 'System'}</span>
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
