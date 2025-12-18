import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgId, table, dryRun = true } = body;

    if (!orgId || !table) {
      return NextResponse.json({ error: 'orgId and table required' }, { status: 400 });
    }

    const allowedTables = ['employees', 'org_units'];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    const { count: nullCount, error: countError } = await supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .is('org_id', null);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        table,
        nullCount: nullCount ?? 0,
        message: `Would update ${nullCount ?? 0} rows with null org_id to org_id=${orgId}`,
      });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from(table)
      .update({ org_id: orgId })
      .is('org_id', null)
      .select('id');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      dryRun: false,
      table,
      updatedCount: data?.length ?? 0,
      message: `Updated ${data?.length ?? 0} rows with org_id=${orgId}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
