"use client";

import { useState, useEffect } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
  PositionAdmin,
} from "@/services/adminCompetence";
import { Plus, Pencil, Trash2, Settings, X } from "lucide-react";

type EditingPosition = PositionAdmin | null;

export default function PositionsAdminPage() {
  const { loading: authLoading } = useAuthGuard();
  const [positions, setPositions] = useState<PositionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<EditingPosition>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    site: "",
    department: "",
  });

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getPositions();
      setPositions(data);
    } catch (err) {
      setError("Failed to load positions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openNewModal() {
    setEditingPosition(null);
    setForm({ name: "", description: "", site: "", department: "" });
    setShowModal(true);
  }

  function openEditModal(pos: PositionAdmin) {
    setEditingPosition(pos);
    setForm({
      name: pos.name,
      description: pos.description || "",
      site: pos.site || "",
      department: pos.department || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        site: form.site || null,
        department: form.department || null,
      };
      if (editingPosition) {
        await updatePosition(editingPosition.id, payload);
      } else {
        await createPosition(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save position");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this position? This will also delete all competence requirements for this position.")) return;
    try {
      await deletePosition(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete position");
    }
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

  const groupedBySite = positions.reduce((acc, pos) => {
    const site = pos.site || "No Site";
    if (!acc[site]) acc[site] = [];
    acc[site].push(pos);
    return acc;
  }, {} as Record<string, PositionAdmin[]>);

  return (
    <main className="hr-page">
      <div className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Positions Admin</h1>
          <p className="hr-page__subtitle">Manage positions and their competence requirements</p>
        </div>
        <button
          className="hr-button hr-button--primary"
          onClick={openNewModal}
          data-testid="button-new-position"
        >
          <Plus size={16} /> New Position
        </button>
      </div>

      <nav className="hr-breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/app/hr/tasks" className="hr-breadcrumb__link">Dashboard</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <span>Positions Admin</span>
      </nav>

      {positions.length === 0 ? (
        <div className="hr-card" style={{ padding: 24, textAlign: "center" }}>
          <p className="hr-muted">No positions yet. Create your first position to get started.</p>
        </div>
      ) : (
        Object.entries(groupedBySite).map(([site, sitePositions]) => (
          <div key={site} className="hr-card" style={{ marginBottom: 16 }}>
            <h2 className="hr-section__title" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hr-border)" }}>
              {site}
            </h2>
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Department</th>
                  <th style={{ width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sitePositions.map((pos) => (
                  <tr key={pos.id} data-testid={`position-row-${pos.id}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{pos.name}</div>
                      {pos.description && (
                        <div className="hr-muted" style={{ fontSize: 13 }}>{pos.description}</div>
                      )}
                    </td>
                    <td>{pos.department || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/admin/positions/${pos.id}/requirements`}>
                          <button
                            className="hr-button hr-button--ghost hr-button--sm"
                            data-testid={`button-requirements-${pos.id}`}
                            title="Manage Requirements"
                          >
                            <Settings size={14} />
                          </button>
                        </Link>
                        <button
                          className="hr-button hr-button--ghost hr-button--sm"
                          onClick={() => openEditModal(pos)}
                          data-testid={`button-edit-${pos.id}`}
                          title="Edit Position"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="hr-button hr-button--ghost hr-button--sm"
                          onClick={() => handleDelete(pos.id)}
                          data-testid={`button-delete-${pos.id}`}
                          title="Delete Position"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {showModal && (
        <div className="hr-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} data-testid="modal-position">
            <div className="hr-modal__header">
              <h2 className="hr-modal__title">{editingPosition ? "Edit Position" : "New Position"}</h2>
              <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="hr-modal__body">
              <div className="hr-form-field">
                <label className="hr-form-label">Name</label>
                <input
                  type="text"
                  className="hr-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-position-name"
                />
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Description</label>
                <textarea
                  className="hr-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  data-testid="input-position-description"
                />
              </div>
              <div className="hr-form-row">
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
              </div>
            </div>
            <div className="hr-modal__footer">
              <button className="hr-button hr-button--secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="hr-button hr-button--primary" onClick={handleSave} data-testid="button-save-position">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
