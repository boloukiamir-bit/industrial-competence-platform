import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const updateRoleSchema = z.object({
  orgId: z.string().uuid(),
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
    const parsed = updateRoleSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
    }

    const { orgId, userId, role } = parsed.data;
    const supabase = getServiceSupabase();

    // Verify actor is org admin
    const isAdmin = await isOrgAdmin(supabase, orgId, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Prevent self-demotion from admin (last admin protection)
    if (userId === user.id && role !== 'admin') {
      const { count } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'admin')
        .eq('status', 'active');

      if (count && count <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin from organization' }, { status: 400 });
      }
    }

    // Get current role for audit log
    const { data: currentMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!currentMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    const oldRole = currentMembership.role;

    // Update role
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role })
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating role:', updateError);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      actor_user_id: user.id,
      action: 'membership.role_updated',
      target_type: 'membership',
      target_id: userId,
      metadata: { old_role: oldRole, new_role: role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
