"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Clock, ArrowRight, Loader2, Plus } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { apiGet } from "@/lib/apiClient";

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  stepCount: number;
};

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg?.id) return;
    
    async function fetchTemplates() {
      try {
        const data = await apiGet<{ templates: WorkflowTemplate[] }>("/api/workflows/templates");
        setTemplates(data.templates || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, [currentOrg?.id]);

  const getCategoryColor = (category: string) => {
    const cat = category.toLowerCase();
    switch (cat) {
      case "onboarding":
      case "hr":
        return "bg-green-500";
      case "offboarding":
      case "safety":
        return "bg-red-500";
      case "rehab":
      case "quality":
        return "bg-blue-500";
      case "production":
        return "bg-orange-500";
      case "maintenance":
        return "bg-yellow-600";
      case "competence":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-templates">
            Workflow Templates
          </h1>
          <p className="text-muted-foreground">
            Standardized processes for HR operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => router.push("/app/workflows/templates/new")}
            data-testid="button-create-template"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push("/app/workflows/instances")}
            data-testid="button-view-instances"
          >
            View Active Workflows
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No workflow templates found. Run the SQL seed script to create templates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card 
              key={template.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => router.push(`/app/workflows/templates/${template.id}`)}
              data-testid={`card-template-${template.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className={getCategoryColor(template.category)}>
                    {template.category}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {template.description || "No description"}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{template.stepCount} steps</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
