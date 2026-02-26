"use client";

import Image from "next/image";
import { useOrgIdentity } from "@/contexts/OrgIdentityContext";
import { Skeleton } from "@/components/ui/skeleton";

function orgInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function OrgIdentity() {
  const { identity, loading, error } = useOrgIdentity();

  if (loading) {
    return (
      <div className="flex items-center gap-3" data-testid="org-identity">
        <Skeleton className="h-8 w-8 shrink-0 rounded" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  if (error || !identity) {
    return (
      <div className="text-sm text-muted-foreground" data-testid="org-identity">
        {error ?? "No organization"}
      </div>
    );
  }

  const { org, site } = identity;
  const initials = orgInitials(org.name);

  return (
    <div
      className="flex items-center gap-3 min-w-0"
      data-testid="org-identity"
      data-org-id={org.id}
      data-site-id={site?.id ?? undefined}
    >
      <span
        className="h-8 w-8 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden"
        aria-hidden
      >
        {org.logo_url ? (
          <Image
            src={org.logo_url}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-xs font-medium text-foreground">{initials}</span>
        )}
      </span>
      <div className="min-w-0 flex flex-col">
        <span className="text-sm font-medium text-foreground truncate">
          {org.name || "Organization"}
        </span>
        {site && (
          <span className="text-xs text-muted-foreground truncate">{site.name}</span>
        )}
      </div>
    </div>
  );
}
