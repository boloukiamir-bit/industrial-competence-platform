import type { InboxItem } from "@/types/inbox";

/**
 * Fetch unified HR inbox items (training, medical, cert).
 * Client-only; use in "use client" components.
 */
export async function getHrInbox(includeResolved = false): Promise<InboxItem[]> {
  const url = `/api/hr/inbox?status=open${includeResolved ? "&includeResolved=1" : "&includeResolved=0"}`;
  const response = await fetch(url, { credentials: "include" });

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    let bodySnippet = "";
    try {
      const text = await response.text();
      try {
        bodySnippet = JSON.stringify(JSON.parse(text));
      } catch {
        bodySnippet = text;
      }
      if (bodySnippet.length > 500) bodySnippet = bodySnippet.slice(0, 500) + "...";
    } catch {
      bodySnippet = "failed to read body";
    }
    throw new Error(
      `HR Inbox fetch failed: ${response.status} ${response.statusText} requestId=${requestId ?? "n/a"} body=${bodySnippet}`
    );
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
