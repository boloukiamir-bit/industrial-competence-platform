'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { OrgGuard } from '@/components/OrgGuard';
import { DataState, useDataState } from '@/components/DataState';
import { apiGet, apiPost } from '@/lib/apiClient';
import { 
  Users, 
  UserPlus, 
  Shield, 
  UserX,
  Loader2,
  Mail,
  Clock,
  Check,
  X
} from 'lucide-react';

interface Member {
  user_id: string;
  role: 'admin' | 'hr' | 'manager' | 'user';
  status: 'active' | 'disabled';
  created_at: string;
  email?: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

interface ApiError {
  message: string;
  code?: string;
  hint?: string;
}

function AdminUsersContent() {
  const { currentOrg, isAdmin } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'hr' | 'manager' | 'user'>('user');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [changingRole, setChangingRole] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentOrg) return;
    
    setLoading(true);
    setError(null);

    try {
      const data = await apiGet<{ members: Member[]; invites: Invite[] }>('/api/admin/members');
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (err) {
      console.error('Fetch error:', err);
      const apiError = { 
        message: err instanceof Error ? err.message : 'Failed to load members',
        code: 'NETWORK_ERROR'
      };
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;

    setInviting(true);
    setInviteError(null);

    try {
      await apiPost('/api/admin/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      setInviteEmail('');
      setInviteRole('user');
      setShowInvite(false);
      await fetchData();
    } catch (err) {
      console.error('Invite error:', err);
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'hr' | 'manager' | 'user') => {
    if (!currentOrg) return;

    setChangingRole(userId);

    try {
      await apiPost('/api/admin/membership/role', {
        orgId: currentOrg.id,
        userId,
        role: newRole,
      });
      await fetchData();
    } catch (err) {
      console.error('Role change error:', err);
    } finally {
      setChangingRole(null);
    }
  };

  const handleDisable = async (userId: string) => {
    if (!currentOrg) return;
    if (!confirm('Are you sure you want to disable this user?')) return;

    try {
      await apiPost('/api/admin/membership/disable', {
        userId,
      });
      await fetchData();
    } catch (err) {
      console.error('Disable error:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const dataStatus = useDataState(members, loading, error);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage members and invites for {currentOrg?.name}
          </p>
        </div>
        {isAdmin && dataStatus !== 'error' && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground flex items-center gap-2"
            data-testid="button-invite-user"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        )}
      </div>

      {showInvite && (
        <div className="p-4 rounded-lg border border-border bg-card">
          {inviteError && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {inviteError}
            </div>
          )}
          <form onSubmit={handleInvite} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1">
                Email Address
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                required
                data-testid="input-invite-email"
              />
            </div>
            <div className="w-40">
              <label htmlFor="invite-role" className="block text-sm font-medium text-foreground mb-1">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                data-testid="select-invite-role"
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 rounded-md border border-border text-foreground"
                data-testid="button-cancel-invite"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"
                data-testid="button-send-invite"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Invite
              </button>
            </div>
          </form>
        </div>
      )}

      <DataState
        status={dataStatus}
        error={error}
        onRetry={fetchData}
        emptyTitle="No members yet"
        emptyMessage="Invite users to join your organization."
        emptyIcon={<Users className="w-8 h-8 text-muted-foreground" />}
        emptyCta={{
          label: 'Invite User',
          onClick: () => setShowInvite(true),
        }}
      >
        <>
          {invites.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="p-4 border-b border-border">
                <h2 className="font-medium text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pending Invites ({invites.length})
                </h2>
              </div>
              <div className="divide-y divide-border">
                {invites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between" data-testid={`row-invite-${invite.id}`}>
                    <div>
                      <div className="text-foreground">{invite.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Invited as {invite.role} - Expires {formatDate(invite.expires_at)}
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="font-medium text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members ({members.filter(m => m.status === 'active').length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Joined</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => (
                    <tr key={member.user_id} className="hover:bg-muted/30" data-testid={`row-member-${member.user_id}`}>
                      <td className="px-4 py-3 text-foreground">
                        {member.email || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && changingRole !== member.user_id ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.user_id, e.target.value as typeof member.role)}
                            className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm"
                            data-testid={`select-role-${member.user_id}`}
                          >
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="hr">HR</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : changingRole === member.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <span className="capitalize">{member.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {member.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <X className="w-3 h-3" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {formatDate(member.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && member.status === 'active' && (
                          <button
                            onClick={() => handleDisable(member.user_id)}
                            className="p-2 rounded text-muted-foreground hover:text-destructive"
                            title="Disable user"
                            data-testid={`button-disable-${member.user_id}`}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      </DataState>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <OrgGuard requireAdmin>
      <AdminUsersContent />
    </OrgGuard>
  );
}
