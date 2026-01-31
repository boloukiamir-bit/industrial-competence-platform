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
      const res = NextResponse.json({ error: 'Forbidden', code: 'NOT_ADMIN', message: 'Admin access required' }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: members, error: memberError } = await supabaseAdmin
      .from('memberships')
      .select('user_id, role, status, created_at')
      .eq('org_id', org.activeOrgId);

    if (memberError) {
      console.error('Error fetching members:', memberError);
      const res = NextResponse.json({ error: 'Database error', code: 'DB_ERROR', message: memberError.message, hint: memberError.hint || null }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const userIds = (members || []).map(m => m.user_id);
    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map(p => [p.id, p.email]));
      }
    }

    const enrichedMembers = (members || []).map(member => ({
      ...member,
      email: profilesMap[member.user_id] || null
    }));

    const { data: invites, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('id, email, role, created_at, expires_at, accepted_at')
      .eq('org_id', org.activeOrgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    if (inviteError) {
      console.error('Error fetching invites:', inviteError);
    }

    const res = NextResponse.json({
      success: true,
      members: enrichedMembers,
      invites: invites || [],
      counts: {
        total: enrichedMembers.length,
        active: enrichedMembers.filter(m => m.status === 'active').length,
        disabled: enrichedMembers.filter(m => m.status === 'disabled').length,
        pendingInvites: (invites || []).length
      }
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error('Members error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
