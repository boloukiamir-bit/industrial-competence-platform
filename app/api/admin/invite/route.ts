import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getActiveOrgFromSession } from '@/lib/server/activeOrg';
import { createSupabaseServerClient, applySupabaseCookies } from '@/lib/supabase/server';

const inviteSchema = z.object({
  email: z.string().email(),
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
    const parsed = inviteSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
    }

    const { email, role } = parsed.data;
    const orgId = org.activeOrgId;
    const userId = org.userId;
    const supabaseAdmin = getServiceSupabase();

    // Verify user is org admin
    const isAdmin = await isOrgAdmin(supabaseAdmin, orgId, userId);
    if (!isAdmin) {
      const res = NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Check if user is already a member
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      const { data: existingMembership } = await supabaseAdmin
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMembership) {
        const res = NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabaseAdmin
      .from('invites')
      .select('id')
      .eq('org_id', orgId)
      .ilike('email', email)
      .is('accepted_at', null)
      .single();

    if (existingInvite) {
      const res = NextResponse.json({ error: 'Pending invite already exists for this email' }, { status: 409 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invites')
      .insert({
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        invited_by: userId,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      const res = NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Write audit log
    await supabaseAdmin.from('audit_logs').insert({
      org_id: orgId,
      actor_user_id: userId,
      action: 'user.invited',
      target_type: 'invite',
      target_id: invite.id,
      metadata: { email, role },
    });

    const res = NextResponse.json({ success: true, invite });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
