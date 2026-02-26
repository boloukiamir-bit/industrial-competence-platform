"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageFrame } from "@/components/layout/PageFrame";
import { HrInboxTabs, type InboxTab, type ActionsFilter } from "@/components/hr/inbox/HrInboxTabs";
import { InboxTable } from "@/components/hr/inbox/InboxTable";
import { PriorityStrip } from "@/components/hr/inbox/PriorityStrip";
import { fetchJson } from "@/lib/coreFetch";
import type { InboxActionItem, InboxLifecycleItem, InboxGovernanceItem, InboxContractItem, InboxMedicalItem, InboxTrainingItem, PrioritySummary } from "@/types/domain";

type InboxResponse = {
  ok: true;
  tab: string;
  items: InboxActionItem[] | InboxLifecycleItem[] | InboxGovernanceItem[] | InboxContractItem[] | InboxMedicalItem[] | InboxTrainingItem[];
  meta: { limit: number };
};

type PriorityResponse = {
  ok: true;
  summary: PrioritySummary;
};

const TAB_DEFAULT: InboxTab = "actions";
const FILTER_DEFAULT: ActionsFilter = "open";

const ZERO_PRIORITY: PrioritySummary = {
  overdueActions: 0,
  unassignedActions: 0,
  legalStops: 0,
  noGoOrWarnings: 0,
};

export default function HrInboxPage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab")?.toLowerCase()?.trim() || TAB_DEFAULT) as InboxTab;
  const filter = (searchParams.get("filter")?.toLowerCase()?.trim() || FILTER_DEFAULT) as ActionsFilter;

  const [items, setItems] = useState<InboxActionItem[] | InboxLifecycleItem[] | InboxGovernanceItem[] | InboxContractItem[] | InboxMedicalItem[] | InboxTrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prioritySummary, setPrioritySummary] = useState<PrioritySummary | null>(null);
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [priorityError, setPriorityError] = useState(false);

  const effectiveTab = useMemo((): InboxTab => {
    if (tab === "lifecycle" || tab === "governance" || tab === "contract" || tab === "medical" || tab === "training") return tab;
    return "actions";
  }, [tab]);

  const effectiveFilter = useMemo((): ActionsFilter => {
    if (effectiveTab !== "actions") return FILTER_DEFAULT;
    if (filter === "overdue" || filter === "due7" || filter === "all") return filter;
    return "open";
  }, [effectiveTab, filter]);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("tab", effectiveTab);
    if (effectiveTab === "actions") params.set("filter", effectiveFilter);
    params.set("limit", "50");
    const result = await fetchJson<InboxResponse>(`/api/hr/inbox?${params.toString()}`);
    if (!result.ok) {
      setItems([]);
      setError(typeof result.error === "string" ? result.error : "Failed to load inbox");
      setLoading(false);
      return;
    }
    setItems(result.data.items);
    setError(null);
    setLoading(false);
  }, [effectiveTab, effectiveFilter]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    let cancelled = false;
    setPriorityLoading(true);
    setPriorityError(false);
    fetchJson<PriorityResponse>("/api/hr/inbox/priority")
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setPrioritySummary(null);
          setPriorityError(true);
          return;
        }
        setPrioritySummary(res.data.summary ?? ZERO_PRIORITY);
        setPriorityError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPrioritySummary(null);
          setPriorityError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setPriorityLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageFrame>
      <h1 className="text-xl font-semibold tracking-tight mb-4">HR ACTION INBOX</h1>
      <div className="mb-4">
        {priorityLoading && !prioritySummary ? (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-24 rounded-md animate-pulse bg-muted" />
            ))}
          </div>
        ) : (
          <PriorityStrip
            summary={prioritySummary ?? ZERO_PRIORITY}
            loading={priorityLoading}
            error={priorityError}
          />
        )}
      </div>
      <HrInboxTabs tab={effectiveTab} filter={effectiveFilter} />
      <div className="mt-4">
        <InboxTable tab={effectiveTab} items={items} loading={loading} error={error} />
      </div>
    </PageFrame>
  );
}
