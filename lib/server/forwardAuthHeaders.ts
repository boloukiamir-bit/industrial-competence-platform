import type { NextRequest } from "next/server";

/**
 * Build headers to forward auth from the incoming request to internal fetches
 * (e.g. cookie-based session or Authorization: Bearer). Use when calling
 * other API routes from a route handler so auth works in both cookie and
 * dev_bearer modes.
 */
export function forwardAuthHeaders(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = {};
  const cookie = req.headers.get("cookie");
  const auth = req.headers.get("authorization");
  if (cookie) h.cookie = cookie;
  if (auth) h.authorization = auth;
  return h;
}
