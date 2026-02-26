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
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
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

    let query = supabaseAdmin
      .from('governance_events')
      .select('id, actor_user_id, action, target_type, target_id, meta, created_at')
      .eq('org_id', org.activeOrgId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200);

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching governance_events (audit):', fetchError);
      return NextResponse.json({
        error: 'Database error',
        code: 'DB_ERROR',
        message: fetchError.message,
        hint: fetchError.hint || null
      }, { status: 500 });
    }

    const logs = rows ?? [];
    const actorIds = [...new Set(logs.map((l: { actor_user_id: string | null }) => l.actor_user_id).filter(Boolean))];

    let profilesMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
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

    type GovRow = {
      id: string;
      actor_user_id: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      meta: unknown;
      created_at: string;
    };
    const enrichedLogs = logs.map((log: GovRow) => ({
      id: log.id,
      actor_user_id: log.actor_user_id ?? '',
      action: log.action,
      target_type: log.target_type,
      target_id: log.target_id,
      metadata: (log.meta != null && typeof log.meta === 'object' && !Array.isArray(log.meta)) ? log.meta as Record<string, unknown> : {},
      created_at: log.created_at,
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
