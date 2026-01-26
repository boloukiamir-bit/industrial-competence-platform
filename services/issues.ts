import type { IssueInboxItem } from "@/types/issues";

/**
 * Client-only function to fetch issue inbox.
 * Must only be imported in client components (marked with "use client").
 */
export async function getIssueInbox(includeResolved?: boolean): Promise<IssueInboxItem[]> {
  // Use relative URL - works in both browser and Next.js server-side fetch
  const url = `/api/issues/inbox${includeResolved ? "?includeResolved=1" : ""}`;

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch issues" }));
    throw new Error(error.error || "Failed to fetch issues");
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
