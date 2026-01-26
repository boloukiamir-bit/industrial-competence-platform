import type { IssueInboxItem } from "@/types/issues";

export async function getIssueInbox(includeResolved?: boolean): Promise<IssueInboxItem[]> {
  const url = new URL("/api/issues/inbox", window.location.origin);
  if (includeResolved) {
    url.searchParams.set("includeResolved", "1");
  }

  const response = await fetch(url.toString(), {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch issues" }));
    throw new Error(error.error || "Failed to fetch issues");
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
