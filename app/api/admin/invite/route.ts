import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { withMutationGovernance } from '@/lib/server/governance/withMutationGovernance';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'hr', 'manager', 'user']),
});

async function isOrgAdmin(admin: SupabaseClient, orgId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return data?.role === 'admin';
}

export const POST = withMutationGovernance(
  async (ctx) => {
    try {
      const parsed = inviteSchema.safeParse(ctx.body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 });
      }
      const { email, role } = parsed.data;

      const isAdmin = await isOrgAdmin(ctx.admin, ctx.orgId, ctx.userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }

      const { data: existingUser } = await ctx.admin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        const { data: existingMembership } = await ctx.admin
          .from('memberships')
          .select('user_id')
          .eq('org_id', ctx.orgId)
          .eq('user_id', existingUser.id)
          .single();
        if (existingMembership) {
          return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
        }
      }

      const { data: existingInvite } = await ctx.admin
        .from('invites')
        .select('id')
        .eq('org_id', ctx.orgId)
        .ilike('email', email)
        .is('accepted_at', null)
        .single();

      if (existingInvite) {
        return NextResponse.json({ error: 'Pending invite already exists for this email' }, { status: 409 });
      }

      const { data: invite, error: inviteError } = await ctx.admin
        .from('invites')
        .insert({
          org_id: ctx.orgId,
          email: email.toLowerCase(),
          role,
          invited_by: ctx.userId,
        })
        .select()
        .single();

      if (inviteError) {
        console.error('Error creating invite:', inviteError);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
      }

      await ctx.admin.from('audit_logs').insert({
        org_id: ctx.orgId,
        actor_user_id: ctx.userId,
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
  },
  {
    route: '/api/admin/invite',
    action: 'ADMIN_INVITE',
    target_type: 'org',
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof (body as { email?: string }).email === 'string' ? `invite:${(body as { email: string }).email}` : 'unknown',
      meta: {},
    }),
  }
);
