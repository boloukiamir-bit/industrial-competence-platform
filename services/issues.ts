import type { IssueInboxItem } from "@/types/issues";

export async function getIssueInbox(): Promise<IssueInboxItem[]> {
  const response = await fetch("/api/issues/inbox", {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch issues" }));
    throw new Error(error.error || "Failed to fetch issues");
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
