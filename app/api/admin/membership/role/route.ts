import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getActiveOrgFromSession } from '@/lib/server/activeOrg';
import { createSupabaseServerClient, applySupabaseCookies } from '@/lib/supabase/server';

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'hr', 'manager', 'user']),
});

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
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

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
    }

    const { userId, role } = parsed.data;
    const orgId = org.activeOrgId;
    const supabaseAdmin = getServiceSupabase();

    // Verify actor is org admin
    const isAdmin = await isOrgAdmin(supabaseAdmin, orgId, org.userId);
    if (!isAdmin) {
      const res = NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Prevent self-demotion from admin (last admin protection)
    if (userId === org.userId && role !== 'admin') {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'admin')
        .eq('status', 'active');

      if (count && count <= 1) {
        const res = NextResponse.json({ error: 'Cannot remove the last admin from organization' }, { status: 400 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }

    // Get current role for audit log
    const { data: currentMembership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!currentMembership) {
      const res = NextResponse.json({ error: 'Membership not found' }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const oldRole = currentMembership.role;

    // Update role
    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({ role })
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating role:', updateError);
      const res = NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Write audit log
    await supabaseAdmin.from('audit_logs').insert({
      org_id: orgId,
      actor_user_id: org.userId,
      action: 'membership.role_updated',
      target_type: 'membership',
      target_id: userId,
      metadata: { old_role: oldRole, new_role: role },
    });

    const res = NextResponse.json({ success: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
