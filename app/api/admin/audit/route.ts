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
        message: 'Authentication required to access audit logs'
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
      .eq('org_id', orgId)
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

    const actorIds = [...new Set((logs || []).map(l => l.actor_user_id).filter(Boolean))];
    
    let profilesMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', actorIds);
      
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map(p => [p.id, p.email]));
      }
    }

    const enrichedLogs = (logs || []).map(log => ({
      ...log,
      actor_email: profilesMap[log.actor_user_id] || null
    }));

    return NextResponse.json({ 
      success: true, 
      logs: enrichedLogs,
      count: enrichedLogs.length
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
