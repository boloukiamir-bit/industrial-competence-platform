"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/apiClient";
import { ChevronLeft, Database, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DEFAULT_PAYLOAD = `{
  "areas": [
    { "code": "BEARB", "name": "Bearbetning" },
    { "code": "OMM", "name": "Ommantling" },
    { "code": "PACK", "name": "Packen" },
    { "code": "LOG", "name": "Logistik" },
    { "code": "MAINT", "name": "Underhåll" }
  ],
  "stations": [
    { "code": "HOMAG_7", "name": "Homag 7", "area_code": "BEARB" },
    { "code": "HOMAG_8", "name": "Homag 8", "area_code": "BEARB" },
    { "code": "IMA_2", "name": "IMA 2", "area_code": "BEARB" },
    { "code": "WEEKE", "name": "Weeke", "area_code": "BEARB" },
    { "code": "SCHELLING_2", "name": "Schelling 2", "area_code": "BEARB" }
  ],
  "shift_codes": [
    { "code": "S1", "name": "Skift 1", "start_time": "07:00", "end_time": "16:00", "break_minutes": 60 },
    { "code": "S2", "name": "Skift 2", "start_time": "16:00", "end_time": "00:00", "break_minutes": 30 },
    { "code": "S3", "name": "Skift 3", "start_time": "00:00", "end_time": "07:00", "break_minutes": 30 }
  ]
}
`;

type Summary = {
  areas: { inserted: number; updated: number };
  stations: { inserted: number; updated: number };
  shift_codes: { inserted: number; updated: number };
  warnings?: string[];
};

type Result = { ok: true; summary: Summary } | { error: string };

export default function SeedFactoryPage() {
  const { toast } = useToast();
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyTemplate = useCallback(() => {
    navigator.clipboard.writeText(DEFAULT_PAYLOAD).then(() => {
      setCopied(true);
      toast({ title: "Copied", description: "Template copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [toast]);

  const handleSeed = useCallback(async () => {
    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      toast({ title: "Invalid JSON", description: "Payload must be valid JSON.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost<Result>("/api/admin/seed/factory", body);
      if (data && "ok" in data && data.ok) {
        setResult(data);
        const s = data.summary;
        const total =
          s.areas.inserted + s.areas.updated + s.stations.inserted + s.stations.updated +
          s.shift_codes.inserted + s.shift_codes.updated;
        toast({
          title: "Seed complete",
          description: total > 0
            ? `Areas: ${s.areas.inserted + s.areas.updated}, Stations: ${s.stations.inserted + s.stations.updated}, Shift codes: ${s.shift_codes.inserted + s.shift_codes.updated}`
            : "No changes (already up to date).",
        });
      } else {
        const err = (data && "error" in data && data.error) ? String(data.error) : "Seed failed";
        setResult({ error: err });
        toast({ title: "Seed failed", description: err, variant: "destructive" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setResult({ error: message });
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [payload, toast]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/app/admin" className="hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Admin
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">Seed Factory Structure</span>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Database className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Seed Factory Structure</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Idempotent seed for areas, stations, and shift codes (active org + site). Admin/HR only.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="seed-payload">JSON payload</Label>
            <Button type="button" variant="ghost" size="sm" onClick={handleCopyTemplate}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span className="ml-1">{copied ? "Copied" : "Copy template"}</span>
            </Button>
          </div>
          <textarea
            id="seed-payload"
            className="w-full h-64 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{ "areas": [], "stations": [], "shift_codes": [] }'
            spellCheck={false}
          />
        </div>

        <Button onClick={handleSeed} disabled={loading} data-testid="button-seed-factory">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Seed
        </Button>

        {result && (
          <div
            className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            data-testid="seed-result"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Result</h3>
            {"error" in result ? (
              <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
            ) : (
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Areas:</span>{" "}
                  {result.summary.areas.inserted} inserted, {result.summary.areas.updated} updated
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Stations:</span>{" "}
                  {result.summary.stations.inserted} inserted, {result.summary.stations.updated} updated
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Shift codes:</span>{" "}
                  {result.summary.shift_codes.inserted} inserted, {result.summary.shift_codes.updated} updated
                </p>
                {result.summary.warnings?.length ? (
                  <ul className="mt-2 text-amber-700 dark:text-amber-300 list-disc list-inside">
                    {result.summary.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
