"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, XCircle, AlertCircle, FileText, Trash2, RefreshCw } from "lucide-react";

type ImportResult = {
  success: boolean;
  importType: string;
  totalRows: number;
  inserted: number;
  updated: number;
  failed: number;
  failedRows: { line: number; reason: string }[];
};

const IMPORT_TYPES = [
  { value: "areas", label: "Areas", order: 1, description: "Production areas / departments" },
  { value: "stations", label: "Stations", order: 2, description: "Work stations within areas" },
  { value: "employees", label: "Employees", order: 3, description: "Employee master data" },
  { value: "skills_catalog", label: "Skills Catalog", order: 4, description: "Skills/competencies list" },
  { value: "employee_skill_ratings", label: "Employee Skill Ratings", order: 5, description: "Skill matrix ratings" },
  { value: "area_leaders", label: "Area Leaders", order: 6, description: "Map leaders to areas" },
  { value: "rating_scales", label: "Rating Scales", order: 7, description: "Rating configuration (optional)" },
];

type DataCounts = {
  areas: number;
  stations: number;
  employees: number;
  skills: number;
  ratings: number;
};

export default function SpaljistenImportPage() {
  const [selectedType, setSelectedType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataCounts, setDataCounts] = useState<DataCounts | null>(null);

  const fetchDataCounts = async () => {
    try {
      const res = await fetch("/api/spaljisten/reset");
      if (res.ok) {
        setDataCounts(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch data counts:", err);
    }
  };

  useEffect(() => {
    fetchDataCounts();
  }, []);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to delete ALL Spaljisten data? This cannot be undone.")) {
      return;
    }
    setIsResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/spaljisten/reset", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
      } else {
        setResult(null);
        fetchDataCounts();
        alert("Dataset reset successfully!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedType) return;

    setIsUploading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("importType", selectedType);

      const response = await fetch("/api/spaljisten/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
        fetchDataCounts();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (result: ImportResult) => {
    if (result.failed > 0) return "destructive";
    if (result.updated > 0) return "default";
    return "default";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-import">
            Spaljisten Data Import
          </h1>
          <p className="text-muted-foreground mt-1">
            Import CSV files to populate the skill matrix. Import in order: Areas &rarr; Stations &rarr; Employees &rarr; Skills &rarr; Ratings.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={handleReset}
          disabled={isResetting}
          data-testid="button-reset"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {isResetting ? "Resetting..." : "Reset All Data"}
        </Button>
      </div>

      {dataCounts && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm">
                <span>Areas: <strong data-testid="count-areas">{dataCounts.areas}</strong></span>
                <span>Stations: <strong data-testid="count-stations">{dataCounts.stations}</strong></span>
                <span>Employees: <strong data-testid="count-employees">{dataCounts.employees}</strong></span>
                <span>Skills: <strong data-testid="count-skills">{dataCounts.skills}</strong></span>
                <span>Ratings: <strong data-testid="count-ratings">{dataCounts.ratings}</strong></span>
              </div>
              <Button size="sm" variant="ghost" onClick={fetchDataCounts} data-testid="button-refresh-counts">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV
          </CardTitle>
          <CardDescription>
            Select import type and upload your CSV file. Existing records will be updated (UPSERT).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Import Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-import-type">
                <SelectValue placeholder="Select what to import..." />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <span className="font-medium">{type.order}. {type.label}</span>
                    <span className="text-muted-foreground text-xs ml-2">({type.description})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                data-testid="input-file"
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || !selectedType || isUploading}
            className="w-full"
            data-testid="button-import"
          >
            {isUploading ? "Importing..." : "Import"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Import Failed</span>
            </div>
            <p className="mt-2 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              Import Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold">{result.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-md">
                <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                <p className="text-sm text-muted-foreground">Inserted</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-md">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>

            {result.failedRows.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">Failed Rows</h4>
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 w-20">Line</th>
                        <th className="text-left p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failedRows.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 font-mono">{row.line}</td>
                          <td className="p-2 text-destructive">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Badge variant={getStatusColor(result)} data-testid="badge-import-status">
              {result.success ? "Import Successful" : "Import Completed with Errors"}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>CSV Format Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium">employees.csv</h4>
            <code className="block bg-muted p-2 rounded mt-1">
              employee_id, employee_name, email, area_code
            </code>
          </div>
          <div>
            <h4 className="font-medium">skills_catalog.csv</h4>
            <code className="block bg-muted p-2 rounded mt-1">
              skill_id, skill_name, station_code, category
            </code>
          </div>
          <div>
            <h4 className="font-medium">employee_skill_ratings.csv</h4>
            <code className="block bg-muted p-2 rounded mt-1">
              employee_id, skill_id, rating (0-4 or N for not assessed)
            </code>
          </div>
          <div>
            <h4 className="font-medium">areas.csv</h4>
            <code className="block bg-muted p-2 rounded mt-1">
              area_code, area_name
            </code>
          </div>
          <div>
            <h4 className="font-medium">stations.csv</h4>
            <code className="block bg-muted p-2 rounded mt-1">
              station_code, station_name, area_code
            </code>
          </div>
          <div>
            <h4 className="font-medium">area_leaders.csv</h4>
            <code className="block bg-muted p-2 rounded mt-1">
              area_code, employee_id, is_primary
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
