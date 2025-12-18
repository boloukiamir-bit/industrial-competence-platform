import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ 
        error: 'Missing orgId', 
        code: 'MISSING_ORG',
        message: 'Organization ID is required'
      }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const isAdmin = await isOrgAdmin(supabase, orgId, user.id);
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Forbidden', 
        code: 'NOT_ADMIN',
        message: 'Admin access required'
      }, { status: 403 });
    }

    const { data: members, error: memberError } = await supabase
      .from('memberships')
      .select('user_id, role, status, created_at')
      .eq('org_id', orgId);

    if (memberError) {
      console.error('Error fetching members:', memberError);
      return NextResponse.json({ 
        error: 'Database error', 
        code: 'DB_ERROR',
        message: memberError.message,
        hint: memberError.hint || null
      }, { status: 500 });
    }

    const userIds = (members || []).map(m => m.user_id);
    
    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
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

    const { data: invites, error: inviteError } = await supabase
      .from('invites')
      .select('id, email, role, created_at, expires_at, accepted_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    if (inviteError) {
      console.error('Error fetching invites:', inviteError);
    }

    return NextResponse.json({ 
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
  } catch (error) {
    console.error('Members error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
