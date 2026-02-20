/**
 * Regression tests for createSupabaseServerClient.
 * Ensures bearer-only requests (request without cookies) do not throw, preventing 500s on API routes.
 */
import { it } from "node:test";
import assert from "node:assert/strict";

const emptyCookieStore = () => Promise.resolve({ getAll: () => [] as { name: string; value: string }[] });

it("createSupabaseServerClient does not throw when request has cookies.getAll (request path)", async () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    const requestLike = {
      headers: new Headers(),
      cookies: { getAll: () => [] as { name: string; value: string }[] },
    };
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    await assert.doesNotReject(createSupabaseServerClient(requestLike as any));
    const result = await createSupabaseServerClient(requestLike as any);
    assert.ok(result.supabase);
    assert.ok(Array.isArray(result.pendingCookies));
  } finally {
    if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
  }
});

it("createSupabaseServerClient does not throw when request.cookies is missing (bearer-only path)", async () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    const requestLike = { headers: new Headers() } as any;
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    await assert.doesNotReject(
      createSupabaseServerClient(requestLike, emptyCookieStore)
    );
    const result = await createSupabaseServerClient(requestLike, emptyCookieStore);
    assert.ok(result.supabase);
    assert.ok(Array.isArray(result.pendingCookies));
  } finally {
    if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
  }
});
