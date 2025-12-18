import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  const results: {
    tables: Record<string, { exists: boolean; hasOrgId: boolean; rlsEnabled: boolean | null }>;
    nullOrgIdCounts: Record<string, number>;
    errors: string[];
  } = {
    tables: {},
    nullOrgIdCounts: {},
    errors: [],
  };

  const tablesToCheck = ['employees', 'org_units'];

  for (const table of tablesToCheck) {
    try {
      const { data: columnsData, error: columnsError } = await supabaseAdmin.rpc('get_table_columns', {
        table_name: table,
      });

      if (columnsError) {
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(1);

        if (fallbackError) {
          if (fallbackError.code === '42P01') {
            results.tables[table] = { exists: false, hasOrgId: false, rlsEnabled: null };
          } else {
            results.errors.push(`${table}: ${fallbackError.message}`);
            results.tables[table] = { exists: true, hasOrgId: false, rlsEnabled: null };
          }
          continue;
        }

        const hasOrgId = fallbackData && fallbackData.length > 0 
          ? 'org_id' in fallbackData[0] 
          : true;
        
        results.tables[table] = { exists: true, hasOrgId, rlsEnabled: null };
      } else {
        const columns = Array.isArray(columnsData) ? columnsData : [];
        const hasOrgId = columns.some((c: { column_name: string }) => c.column_name === 'org_id');
        results.tables[table] = { exists: true, hasOrgId, rlsEnabled: null };
      }

      const { count: nullCount, error: nullError } = await supabaseAdmin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .is('org_id', null);

      if (!nullError && nullCount !== null) {
        results.nullOrgIdCounts[table] = nullCount;
      }
    } catch (err) {
      results.errors.push(`${table}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  try {
    const { data: rlsData, error: rlsError } = await supabaseAdmin.rpc('check_rls_status', {
      table_names: tablesToCheck,
    });

    if (!rlsError && rlsData) {
      for (const row of rlsData) {
        if (results.tables[row.tablename]) {
          results.tables[row.tablename].rlsEnabled = row.rowsecurity;
        }
      }
    }
  } catch {
    for (const table of tablesToCheck) {
      if (results.tables[table]) {
        results.tables[table].rlsEnabled = null;
      }
    }
  }

  return NextResponse.json(results);
}
