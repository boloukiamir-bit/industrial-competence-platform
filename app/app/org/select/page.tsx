'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { supabase } from '@/lib/supabaseClient';
import { Building2, Plus, ArrowRight, Loader2 } from 'lucide-react';

export default function OrgSelectPage() {
  const { memberships, isLoading, selectOrg, refreshMemberships } = useOrg();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleSelectOrg = (orgId: string) => {
    selectOrg(orgId);
    router.push('/app');
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        setCreating(false);
        return;
      }

      const res = await fetch('/api/org/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, slug }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create organization');
        setCreating(false);
        return;
      }

      // Refresh memberships and select new org
      await refreshMemberships();
      selectOrg(data.organization.id);
      router.push('/app');
    } catch (err) {
      console.error('Create org error:', err);
      setError('Failed to create organization');
      setCreating(false);
    }
  };

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-orgs">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Select Organization
          </h1>
          <p className="text-muted-foreground mt-2">
            Choose an organization to continue
          </p>
        </div>

        {memberships.length > 0 && (
          <div className="space-y-2">
            {memberships.map((membership, index) => (
              <button
                key={membership.org_id}
                onClick={() => handleSelectOrg(membership.org_id)}
                className="w-full p-4 rounded-lg border border-border bg-card hover-elevate flex items-center justify-between group"
                data-testid={process.env.NODE_ENV === "production" ? `button-select-org-${index}` : `button-select-org-${membership.org_id}`}
              >
                <div className="text-left">
                  <div className="font-medium text-foreground">
                    {membership.organization?.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-6">
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full p-4 rounded-lg border border-dashed border-border hover-elevate flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              data-testid="button-show-create-org"
            >
              <Plus className="w-5 h-5" />
              Create New Organization
            </button>
          ) : (
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label htmlFor="org-name" className="block text-sm font-medium text-foreground mb-1">
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug || slug === generateSlug(name)) {
                      setSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder="Acme Corporation"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  data-testid="input-org-name"
                />
              </div>

              <div>
                <label htmlFor="org-slug" className="block text-sm font-medium text-foreground mb-1">
                  URL Slug
                </label>
                <input
                  id="org-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="acme-corp"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  pattern="^[a-z0-9-]+$"
                  data-testid="input-org-slug"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive" data-testid="text-error">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-md border border-border text-foreground hover-elevate"
                  data-testid="button-cancel-create"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover-elevate disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="button-create-org"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
