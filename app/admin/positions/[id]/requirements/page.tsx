"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  getPositionById,
  listPositionRequirements,
  listCompetences,
  listCompetenceGroups,
  createPositionRequirement,
  updatePositionRequirement,
  deletePositionRequirement,
  PositionAdmin,
  PositionRequirementAdmin,
  Competence,
  CompetenceGroup,
} from "@/services/adminCompetence";
import { Plus, Trash2, X, Check, ArrowLeft, Pencil } from "lucide-react";

type RequirementWithCompetence = PositionRequirementAdmin & {
  competence_name: string;
  competence_code: string | null;
  group_name: string | null;
};

export default function PositionRequirementsPage() {
  const params = useParams();
  const positionId = params.id as string;
  const { loading: authLoading } = useAuthGuard();

  const [position, setPosition] = useState<PositionAdmin | null>(null);
  const [requirements, setRequirements] = useState<RequirementWithCompetence[]>([]);
  const [allCompetences, setAllCompetences] = useState<Competence[]>([]);
  const [groups, setGroups] = useState<CompetenceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    competence_id: "",
    required_level: 1,
    mandatory: true,
    notes: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    required_level: 1,
    mandatory: true,
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && positionId) {
      loadData();
    }
  }, [authLoading, positionId]);

  async function loadData() {
    try {
      setLoading(true);
      const [posData, reqData, compData, groupData] = await Promise.all([
        getPositionById(positionId),
        listPositionRequirements(positionId),
        listCompetences(),
        listCompetenceGroups(),
      ]);

      if (!posData) {
        setError("Position not found");
        return;
      }

      setPosition(posData);
      setGroups(groupData);
      setAllCompetences(compData);

      const enrichedReqs: RequirementWithCompetence[] = reqData.map((req) => {
        const comp = compData.find((c) => c.id === req.competence_id);
        const group = comp?.group_id ? groupData.find((g) => g.id === comp.group_id) : null;
        return {
          ...req,
          competence_name: comp?.name || "Unknown",
          competence_code: comp?.code || null,
          group_name: group?.name || null,
        };
      });

      setRequirements(enrichedReqs);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRequirement() {
    if (!addForm.competence_id) {
      alert("Please select a competence");
      return;
    }

    try {
      await createPositionRequirement({
        position_id: positionId,
        competence_id: addForm.competence_id,
        required_level: addForm.required_level,
        mandatory: addForm.mandatory,
        notes: addForm.notes || undefined,
      });
      setShowAddForm(false);
      setAddForm({ competence_id: "", required_level: 1, mandatory: true, notes: "" });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add requirement");
    }
  }

  function startEdit(req: RequirementWithCompetence) {
    setEditingId(req.id);
    setEditForm({
      required_level: req.required_level,
      mandatory: req.mandatory,
      notes: req.notes || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ required_level: 1, mandatory: true, notes: "" });
  }

  async function handleSaveEdit() {
    if (!editingId) return;

    try {
      await updatePositionRequirement(editingId, {
        required_level: editForm.required_level,
        mandatory: editForm.mandatory,
        notes: editForm.notes || null,
      });
      setEditingId(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to update requirement");
    }
  }

  async function handleDeleteRequirement(reqId: string) {
    if (!confirm("Remove this competence requirement?")) return;
    try {
      await deletePositionRequirement(reqId);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete requirement");
    }
  }

  if (authLoading) {
    return (
      <main className="hr-page">
        <p>Checking access…</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="hr-page">
        <p className="hr-page__subtitle">Loading...</p>
      </main>
    );
  }

  if (error || !position) {
    return (
      <main className="hr-page">
        <p className="hr-error">{error || "Position not found"}</p>
        <Link href="/admin/positions" className="hr-button hr-button--secondary" style={{ marginTop: 16 }}>
          Back to Positions
        </Link>
      </main>
    );
  }

  const existingCompetenceIds = new Set(requirements.map((r) => r.competence_id));
  const availableCompetences = allCompetences.filter((c) => c.active && !existingCompetenceIds.has(c.id));

  const groupedAvailable = groups.map((g) => ({
    group: g,
    competences: availableCompetences.filter((c) => c.group_id === g.id),
  })).filter((g) => g.competences.length > 0);

  const ungroupedAvailable = availableCompetences.filter((c) => !c.group_id);

  return (
    <main className="hr-page">
      <div className="hr-page__header">
        <div>
          <Link href="/admin/positions" className="hr-link" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }} data-testid="link-back">
            <ArrowLeft size={16} /> Back to positions
          </Link>
          <h1 className="hr-page__title">{position.name} – Requirements</h1>
          <p className="hr-page__subtitle">
            {position.site || "No site"}
            {position.department && ` / ${position.department}`}
          </p>
        </div>
      </div>

      <nav className="hr-breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/app/hr/tasks" className="hr-breadcrumb__link">Dashboard</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <Link href="/admin/positions" className="hr-breadcrumb__link">Positions</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <span>{position.name} Requirements</span>
      </nav>

      <div className="hr-card">
        <div className="hr-section__title" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hr-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span>Competence Requirements</span>
          {!showAddForm && (
            <button
              className="hr-button hr-button--primary hr-button--sm"
              onClick={() => setShowAddForm(true)}
              disabled={availableCompetences.length === 0}
              data-testid="button-add-requirement"
            >
              <Plus size={14} /> Add Requirement
            </button>
          )}
        </div>

        <div style={{ padding: 16 }}>
          {showAddForm && (
            <div style={{ marginBottom: 16, padding: 16, background: "var(--hr-bg-secondary)", borderRadius: 8 }}>
              <h4 className="hr-section__title" style={{ marginBottom: 12 }}>Add Requirement</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="hr-form-field">
                  <label className="hr-form-label">Competence *</label>
                  <select
                    className="hr-select"
                    value={addForm.competence_id}
                    onChange={(e) => setAddForm({ ...addForm, competence_id: e.target.value })}
                    data-testid="select-competence"
                  >
                    <option value="">Select a competence...</option>
                    {groupedAvailable.map((g) => (
                      <optgroup key={g.group.id} label={g.group.name}>
                        {g.competences.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `[${c.code}] ` : ""}{c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {ungroupedAvailable.length > 0 && (
                      <optgroup label="Ungrouped">
                        {ungroupedAvailable.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `[${c.code}] ` : ""}{c.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="hr-form-field">
                  <label className="hr-form-label">Required Level (0-3)</label>
                  <select
                    className="hr-select"
                    value={addForm.required_level}
                    onChange={(e) => setAddForm({ ...addForm, required_level: parseInt(e.target.value) })}
                    data-testid="select-level"
                  >
                    {[0, 1, 2, 3].map((level) => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </select>
                </div>
                <div className="hr-form-field hr-form-field--inline">
                  <input
                    type="checkbox"
                    id="add-mandatory"
                    checked={addForm.mandatory}
                    onChange={(e) => setAddForm({ ...addForm, mandatory: e.target.checked })}
                    data-testid="checkbox-mandatory"
                  />
                  <label htmlFor="add-mandatory" className="hr-form-label">Mandatory</label>
                </div>
                <div className="hr-form-field">
                  <label className="hr-form-label">Notes</label>
                  <input
                    type="text"
                    className="hr-input"
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    placeholder="Optional notes"
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="hr-button hr-button--primary hr-button--sm" onClick={handleAddRequirement} data-testid="button-save-requirement">
                  <Check size={14} /> Add Requirement
                </button>
                <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => { setShowAddForm(false); setAddForm({ competence_id: "", required_level: 1, mandatory: true, notes: "" }); }}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          {requirements.length === 0 ? (
            <p className="hr-muted" style={{ textAlign: "center", padding: 24 }}>
              No competence requirements defined for this position.
            </p>
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Competence</th>
                  <th style={{ width: 130 }}>Required Level</th>
                  <th style={{ width: 100 }}>Mandatory</th>
                  <th>Notes</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((req) => (
                  <tr key={req.id} data-testid={`requirement-row-${req.id}`}>
                    {editingId === req.id ? (
                      <>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {req.competence_code && <span className="hr-code">{req.competence_code}</span>}
                            {req.competence_name}
                          </div>
                          {req.group_name && <div className="hr-muted" style={{ fontSize: 12 }}>{req.group_name}</div>}
                        </td>
                        <td>
                          <select
                            className="hr-select hr-select--sm"
                            value={editForm.required_level}
                            onChange={(e) => setEditForm({ ...editForm, required_level: parseInt(e.target.value) })}
                            data-testid={`select-edit-level-${req.id}`}
                          >
                            {[0, 1, 2, 3].map((level) => (
                              <option key={level} value={level}>Level {level}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editForm.mandatory}
                            onChange={(e) => setEditForm({ ...editForm, mandatory: e.target.checked })}
                            data-testid={`checkbox-edit-mandatory-${req.id}`}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="hr-input hr-input--sm"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Notes"
                            data-testid={`input-edit-notes-${req.id}`}
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="hr-button hr-button--primary hr-button--sm"
                              onClick={handleSaveEdit}
                              data-testid={`button-save-${req.id}`}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="hr-button hr-button--ghost hr-button--sm"
                              onClick={cancelEdit}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {req.competence_code && <span className="hr-code">{req.competence_code}</span>}
                            {req.competence_name}
                          </div>
                          {req.group_name && <div className="hr-muted" style={{ fontSize: 12 }}>{req.group_name}</div>}
                        </td>
                        <td>Level {req.required_level}</td>
                        <td>{req.mandatory ? "Yes" : "No"}</td>
                        <td className="hr-muted">{req.notes || "-"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="hr-button hr-button--ghost hr-button--sm"
                              onClick={() => startEdit(req)}
                              data-testid={`button-edit-${req.id}`}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="hr-button hr-button--ghost hr-button--sm"
                              onClick={() => handleDeleteRequirement(req.id)}
                              data-testid={`button-delete-${req.id}`}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
