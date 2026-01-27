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
    // Read diagnostic information
    const requestId = response.headers.get("x-request-id");
    const status = response.status;
    const statusText = response.statusText;
    
    // Read body as text first, then try to parse as JSON
    let bodyText = "";
    let bodySnippet = "";
    try {
      bodyText = await response.text();
      // Try to parse as JSON for better formatting
      try {
        const bodyJson = JSON.parse(bodyText);
        bodySnippet = JSON.stringify(bodyJson);
      } catch {
        // Not JSON, use raw text
        bodySnippet = bodyText;
      }
      // Limit to 500 chars
      if (bodySnippet.length > 500) {
        bodySnippet = bodySnippet.substring(0, 500) + "...";
      }
    } catch {
      bodySnippet = "failed to read body";
    }
    
    const errorMessage = `IssueInbox fetch failed: ${status} ${statusText} requestId=${requestId ?? "n/a"} body=${bodySnippet}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
