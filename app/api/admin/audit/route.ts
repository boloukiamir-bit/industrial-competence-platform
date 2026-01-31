import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveOrgFromSession } from '@/lib/server/activeOrg';
import { createSupabaseServerClient, applySupabaseCookies } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase configuration');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function isOrgAdmin(supabase: ReturnType<typeof getServiceSupabase>, orgId: string, userId: string) {
  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return data?.role === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error, code: org.status === 401 ? 'AUTH_REQUIRED' : 'NO_ORG', message: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const supabaseAdmin = getServiceSupabase();
    const isAdmin = await isOrgAdmin(supabaseAdmin, org.activeOrgId, org.userId);
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Forbidden', 
        code: 'NOT_ADMIN',
        message: 'Admin access required to view audit logs'
      }, { status: 403 });
    }

    const { data: logs, error: fetchError } = await supabase
      .from('audit_logs')
      .select(`
        id,
        actor_user_id,
        action,
        target_type,
        target_id,
        metadata,
        created_at
      `)
      .eq('org_id', org.activeOrgId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching audit logs:', fetchError);
      return NextResponse.json({ 
        error: 'Database error', 
        code: 'DB_ERROR',
        message: fetchError.message,
        hint: fetchError.hint || null
      }, { status: 500 });
    }

    const actorIds = [...new Set((logs || []).map((l: { actor_user_id: string | null }) => l.actor_user_id).filter(Boolean))];
    
    let profilesMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', actorIds);
      
      if (profiles) {
        type ProfileRow = { id: string; email: string | null };
        profilesMap = Object.fromEntries(
          (profiles as ProfileRow[]).map((p: ProfileRow) => [p.id, p.email ?? ""])
        );
      }
    }

    type AuditLogRow = {
      id: string;
      actor_user_id: string | null;
      action: string;
      target_type: string | null;
      target_id: string | null;
      metadata: unknown;
      created_at: string;
    };
    const enrichedLogs = (logs || []).map((log: AuditLogRow) => ({
      ...log,
      actor_email: log.actor_user_id ? (profilesMap[log.actor_user_id] ?? null) : null
    }));

    const res = NextResponse.json({ success: true, logs: enrichedLogs, count: enrichedLogs.length });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
