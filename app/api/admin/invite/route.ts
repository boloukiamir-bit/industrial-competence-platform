import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const inviteSchema = z.object({
  orgId: z.string().uuid(),
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

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const supabase = getServiceSupabase();
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  
  return user;
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
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
    }

    const { orgId, email, role } = parsed.data;
    const supabase = getServiceSupabase();

    // Verify user is org admin
    const isAdmin = await isOrgAdmin(supabase, orgId, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Check if user is already a member
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      const { data: existingMembership } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMembership) {
        return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('id')
      .eq('org_id', orgId)
      .ilike('email', email)
      .is('accepted_at', null)
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'Pending invite already exists for this email' }, { status: 409 });
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      actor_user_id: user.id,
      action: 'user.invited',
      target_type: 'invite',
      target_id: invite.id,
      metadata: { email, role },
    });

    return NextResponse.json({ success: true, invite });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
