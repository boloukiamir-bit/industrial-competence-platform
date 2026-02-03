"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { apiPost } from "@/lib/apiClient";

const CATEGORIES = ["Production", "Safety", "HR", "Quality", "Maintenance", "Competence"];
const OWNER_ROLES = ["HR", "Supervisor", "IT", "Quality", "Maintenance", "Employee"];

type Step = {
  id: string;
  step_order: number;
  title: string;
  description: string;
  owner_role: string;
  default_due_days: number;
  required: boolean;
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function NewTemplatePage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    {
      id: generateId(),
      step_order: 1,
      title: "",
      description: "",
      owner_role: "Supervisor",
      default_due_days: 0,
      required: false,
    },
  ]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: generateId(),
        step_order: steps.length + 1,
        title: "",
        description: "",
        owner_role: "Supervisor",
        default_due_days: 0,
        required: false,
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length === 1) return;
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === steps.length - 1) return;

    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const updateStep = (index: number, field: keyof Step, value: string | number | boolean) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    if (!category) {
      setError("Please select a category");
      return;
    }

    const emptyStepIndex = steps.findIndex((s) => !s.title.trim());
    if (emptyStepIndex !== -1) {
      setError(`Step ${emptyStepIndex + 1} title is required`);
      return;
    }

    setSaving(true);

    try {
      const data = await apiPost<{ templateId: string }>("/api/workflows/templates", {
        name: name.trim(),
        category,
        description: description.trim() || null,
        steps: steps.map((s) => ({
          step_order: s.step_order,
          title: s.title.trim(),
          description: s.description.trim() || null,
          owner_role: s.owner_role,
          default_due_days: s.default_due_days,
          required: s.required,
        })),
      });

      router.push(`/app/workflows/templates/${data.templateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/app/workflows/templates")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-create-template">
            Create Workflow Template
          </h1>
          <p className="text-muted-foreground">
            Define a reusable workflow with steps and assignments
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily Safety Checklist"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Category <span className="text-destructive">*</span>
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this workflow template"
              rows={3}
              data-testid="input-template-description"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Steps</CardTitle>
          <Button onClick={addStep} size="sm" data-testid="button-add-step">
            <Plus className="mr-2 h-4 w-4" />
            Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => (
            <Card key={step.id} className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveStep(index, "up")}
                      disabled={index === 0}
                      data-testid={`button-move-up-${index}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-bold text-muted-foreground">
                      {step.step_order}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveStep(index, "down")}
                      disabled={index === steps.length - 1}
                      data-testid={`button-move-down-${index}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Title <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={step.title}
                          onChange={(e) => updateStep(index, "title", e.target.value)}
                          placeholder="Step title"
                          data-testid={`input-step-title-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Owner Role</label>
                        <Select
                          value={step.owner_role}
                          onValueChange={(value) => updateStep(index, "owner_role", value)}
                        >
                          <SelectTrigger data-testid={`select-owner-role-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OWNER_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Due Days</label>
                        <Input
                          type="number"
                          min={0}
                          value={step.default_due_days}
                          onChange={(e) =>
                            updateStep(index, "default_due_days", parseInt(e.target.value) || 0)
                          }
                          data-testid={`input-due-days-${index}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Checkbox
                          id={`required-${index}`}
                          checked={step.required}
                          onCheckedChange={(checked) =>
                            updateStep(index, "required", checked === true)
                          }
                          data-testid={`checkbox-required-${index}`}
                        />
                        <label htmlFor={`required-${index}`} className="text-sm">
                          Required step
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(index)}
                    disabled={steps.length === 1}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-remove-step-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/app/workflows/templates")}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || !currentOrg?.id}
          data-testid="button-save-template"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
