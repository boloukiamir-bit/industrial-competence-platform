"use client";

import { useState, useEffect } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  listPositions,
  createPosition,
  PositionAdmin,
} from "@/services/adminCompetence";
import { Plus, Settings, X } from "lucide-react";

export default function PositionsAdminPage() {
  const { loading: authLoading } = useAuthGuard();
  const [positions, setPositions] = useState<PositionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    site: "",
    department: "",
    min_headcount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await listPositions();
      setPositions(data);
    } catch (err) {
      setError("Failed to load positions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePosition() {
    if (!form.name.trim()) {
      alert("Name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await createPosition({
        name: form.name,
        description: form.description || undefined,
        site: form.site || undefined,
        department: form.department || undefined,
        min_headcount: form.min_headcount ? parseInt(form.min_headcount) : undefined,
      });
      setForm({ name: "", description: "", site: "", department: "", min_headcount: "" });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to create position");
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearForm() {
    setForm({ name: "", description: "", site: "", department: "", min_headcount: "" });
  }

  if (authLoading || loading) {
    return (
      <main className="hr-page">
        <p className="hr-page__subtitle">Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="hr-page">
        <p className="hr-error">{error}</p>
      </main>
    );
  }

  return (
    <main className="hr-page">
      <div className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Positions</h1>
          <p className="hr-page__subtitle">Define roles, their headcount targets and context (site, department).</p>
        </div>
      </div>

      <nav className="hr-breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/app/hr/tasks" className="hr-breadcrumb__link">Dashboard</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <span>Positions</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="hr-card" data-testid="panel-positions">
          <div className="hr-section__title" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hr-border)" }}>
            Positions
          </div>
          <div style={{ padding: 16 }}>
            {positions.length === 0 ? (
              <p className="hr-muted" style={{ textAlign: "center", padding: 24 }}>
                No positions yet. Create your first position to get started.
              </p>
            ) : (
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Site</th>
                    <th>Department</th>
                    <th style={{ width: 100 }}>Min Headcount</th>
                    <th style={{ width: 100 }}>Requirements</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} data-testid={`position-row-${pos.id}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{pos.name}</div>
                        {pos.description && (
                          <div className="hr-muted" style={{ fontSize: 13 }}>{pos.description}</div>
                        )}
                      </td>
                      <td>{pos.site || "-"}</td>
                      <td>{pos.department || "-"}</td>
                      <td>{pos.min_headcount ?? "-"}</td>
                      <td>
                        <Link href={`/admin/positions/${pos.id}/requirements`}>
                          <button
                            className="hr-button hr-button--secondary hr-button--sm"
                            data-testid={`button-requirements-${pos.id}`}
                          >
                            <Settings size={14} /> Edit
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="hr-card" data-testid="panel-create-position">
          <div className="hr-section__title" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hr-border)" }}>
            Create New Position
          </div>
          <div style={{ padding: 16 }}>
            <div className="hr-form-field">
              <label className="hr-form-label">Name *</label>
              <input
                type="text"
                className="hr-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., CNC Operator"
                data-testid="input-position-name"
              />
            </div>
            <div className="hr-form-field">
              <label className="hr-form-label">Description</label>
              <textarea
                className="hr-textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
                data-testid="input-position-description"
              />
            </div>
            <div className="hr-form-field">
              <label className="hr-form-label">Site</label>
              <input
                type="text"
                className="hr-input"
                value={form.site}
                onChange={(e) => setForm({ ...form, site: e.target.value })}
                placeholder="e.g., Gothenburg"
                data-testid="input-position-site"
              />
            </div>
            <div className="hr-form-field">
              <label className="hr-form-label">Department</label>
              <input
                type="text"
                className="hr-input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g., Production"
                data-testid="input-position-department"
              />
            </div>
            <div className="hr-form-field">
              <label className="hr-form-label">Min Headcount</label>
              <input
                type="number"
                className="hr-input"
                value={form.min_headcount}
                onChange={(e) => setForm({ ...form, min_headcount: e.target.value })}
                placeholder="e.g., 2"
                min="0"
                data-testid="input-position-min-headcount"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                className="hr-button hr-button--primary"
                onClick={handleCreatePosition}
                disabled={isSubmitting}
                data-testid="button-create-position"
              >
                <Plus size={14} /> {isSubmitting ? "Creating..." : "Create Position"}
              </button>
              <button
                className="hr-button hr-button--ghost"
                onClick={clearForm}
                disabled={isSubmitting}
              >
                <X size={14} /> Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
