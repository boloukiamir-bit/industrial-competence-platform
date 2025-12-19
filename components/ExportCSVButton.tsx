"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportCSVButtonProps {
  headers: string[];
  rows: string[][];
  filename: string;
}

export function ExportCSVButton({ headers, rows, filename }: ExportCSVButtonProps) {
  const handleExport = () => {
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      variant="default"
      onClick={handleExport}
      data-testid="button-export-csv"
    >
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
