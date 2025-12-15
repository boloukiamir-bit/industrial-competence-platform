"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, ExternalLink, Loader2 } from "lucide-react";
import type { Document } from "@/types/domain";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", type: "handbook", url: "" });

  const fetchDocuments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .is("employee_id", null)
      .order("created_at", { ascending: false });

    setDocuments(
      (data || []).map((d: any) => ({
        id: d.id,
        employeeId: d.employee_id,
        title: d.title,
        type: d.type,
        url: d.url,
        createdAt: d.created_at,
        validTo: d.valid_to,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleAddDocument = async () => {
    if (!newDoc.title || !newDoc.url) return;

    await supabase.from("documents").insert({
      title: newDoc.title,
      type: newDoc.type,
      url: newDoc.url,
      employee_id: null,
    });

    setNewDoc({ title: "", type: "handbook", url: "" });
    setShowAddForm(false);
    fetchDocuments();
  };

  const typeLabels: Record<string, string> = {
    contract: "Contract",
    handbook: "Handbook",
    policy: "Policy",
    certificate: "Certificate",
    other: "Other",
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Company Documents</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-document">
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Add Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Title"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                data-testid="input-doc-title"
              />
              <Select
                value={newDoc.type}
                onValueChange={(value: string) => setNewDoc({ ...newDoc, type: value })}
              >
                <SelectTrigger data-testid="select-doc-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="handbook">Handbook</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="contract">Contract Template</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="URL"
                value={newDoc.url}
                onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                data-testid="input-doc-url"
              />
            </div>
            <Button className="mt-4" onClick={handleAddDocument} data-testid="button-save-document">
              Save Document
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {doc.title}
                </CardTitle>
                <Badge variant="outline">{typeLabels[doc.type] || doc.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline"
                data-testid={`link-document-${doc.id}`}
              >
                <ExternalLink className="h-3 w-3" />
                Open Document
              </a>
            </CardContent>
          </Card>
        ))}

        {documents.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No documents yet. Click &quot;Add Document&quot; to upload your first document.
          </div>
        )}
      </div>
    </div>
  );
}
