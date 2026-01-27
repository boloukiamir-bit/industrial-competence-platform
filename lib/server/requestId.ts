/**
 * Request ID helper for API route correlation tracking.
 */

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

/**
 * Get or create a request ID for correlation tracking.
 * Checks for X-Request-Id header first, otherwise generates a new UUID.
 */
export function getRequestId(request: NextRequest): string {
  const existingId = request.headers.get("x-request-id");
  if (existingId) {
    return existingId;
  }
  return randomUUID();
}
