"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";

type TemplateSummary = {
  id: string;
  name: string;
  description: string;
  stepCount: number;
};

type CategoryGroup = {
  category: string;
  templates: TemplateSummary[];
};

const CATEGORY_LABELS: Record<string, string> = {
  license: "License",
  medical: "Medical",
  contract: "Contract",
};

export default function ActionPacksListPage() {
  const { currentOrg } = useOrg();
  const [data, setData] = useState<{ categories: CategoryGroup[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) return;
    let cancelled = false;
    fetch("/api/hr/templates/action-packs", { credentials: "include" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) {
          setError(body.error);
          setData(null);
          return;
        }
        setData({ categories: body.categories ?? [] });
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrg?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/app/hr/templates">Back to HR Templates</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = data?.categories ?? [];
  const hasAny = categories.some((c) => c.templates.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/hr/templates">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compliance action packs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ready-to-use action templates by category: license, medical, contract
          </p>
        </div>
      </div>

      {!hasAny ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 px-6 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No action pack templates yet.</p>
            <p className="text-sm mt-1">Admin/HR can add templates under license, medical, or contract categories.</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/app/hr/templates">Back to HR Templates</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map(
            (group) =>
              group.templates.length > 0 && (
                <Card key={group.category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="secondary">{CATEGORY_LABELS[group.category] ?? group.category}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {group.templates.map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`/app/hr/templates/action-packs/${t.id}`}
                            className="flex items-center justify-between gap-2 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{t.name}</p>
                              {t.description ? (
                                <p className="text-sm text-muted-foreground truncate mt-0.5">{t.description}</p>
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{t.stepCount} steps</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/hr/templates">Back to HR Templates</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
