"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  getPosition,
  getPositionRequirements,
  getCompetences,
  getCompetenceGroups,
  createPositionRequirement,
  updatePositionRequirement,
  deletePositionRequirement,
  PositionAdmin,
  PositionRequirementWithCompetence,
  Competence,
  CompetenceGroup,
} from "@/services/adminCompetence";
import { Plus, Trash2, X, Shield, ArrowLeft } from "lucide-react";

export default function PositionRequirementsPage() {
  const params = useParams();
  const positionId = params.id as string;
  const { loading: authLoading } = useAuthGuard();
  
  const [position, setPosition] = useState<PositionAdmin | null>(null);
  const [requirements, setRequirements] = useState<PositionRequirementWithCompetence[]>([]);
  const [allCompetences, setAllCompetences] = useState<Competence[]>([]);
  const [groups, setGroups] = useState<CompetenceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    competence_id: "",
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
        getPosition(positionId),
        getPositionRequirements(positionId),
        getCompetences(),
        getCompetenceGroups(),
      ]);
      
      if (!posData) {
        setError("Position not found");
        return;
      }
      
      setPosition(posData);
      setRequirements(reqData);
      setAllCompetences(compData);
      setGroups(groupData);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setAddForm({ competence_id: "", required_level: 1, mandatory: true, notes: "" });
    setShowAddModal(true);
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
        notes: addForm.notes || null,
      });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add requirement");
    }
  }

  async function handleUpdateLevel(reqId: string, newLevel: number) {
    try {
      await updatePositionRequirement(reqId, { required_level: newLevel });
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, required_level: newLevel } : r))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update level");
    }
  }

  async function handleToggleMandatory(reqId: string, currentValue: boolean) {
    try {
      await updatePositionRequirement(reqId, { mandatory: !currentValue });
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, mandatory: !currentValue } : r))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update mandatory status");
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

  if (authLoading || loading) {
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

  const groupedRequirements = groups.map((g) => ({
    group: g,
    requirements: requirements.filter((r) => r.group_name === g.name),
  })).filter((g) => g.requirements.length > 0);

  const ungroupedRequirements = requirements.filter((r) => !r.group_name);

  return (
    <main className="hr-page">
      <div className="hr-page__header">
        <div>
          <Link href="/admin/positions" className="hr-link" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <ArrowLeft size={16} /> Back to Positions
          </Link>
          <h1 className="hr-page__title">{position.name}</h1>
          <p className="hr-page__subtitle">
            {position.site && <span>{position.site}</span>}
            {position.department && <span> / {position.department}</span>}
            {position.min_headcount && <span> | Min headcount: {position.min_headcount}</span>}
          </p>
        </div>
        <button
          className="hr-button hr-button--primary"
          onClick={openAddModal}
          disabled={availableCompetences.length === 0}
          data-testid="button-add-requirement"
        >
          <Plus size={16} /> Add Requirement
        </button>
      </div>

      <nav className="hr-breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/app/hr/tasks" className="hr-breadcrumb__link">Dashboard</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <Link href="/admin/positions" className="hr-breadcrumb__link">Positions</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <span>{position.name} Requirements</span>
      </nav>

      {requirements.length === 0 ? (
        <div className="hr-card" style={{ padding: 24, textAlign: "center" }}>
          <p className="hr-muted">No competence requirements defined for this position.</p>
          <button
            className="hr-button hr-button--primary"
            onClick={openAddModal}
            style={{ marginTop: 16 }}
            disabled={availableCompetences.length === 0}
          >
            <Plus size={16} /> Add First Requirement
          </button>
        </div>
      ) : (
        <div className="hr-card">
          <table className="hr-table">
            <thead>
              <tr>
                <th>Competence</th>
                <th>Group</th>
                <th style={{ width: 120 }}>Required Level</th>
                <th style={{ width: 100 }}>Mandatory</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...groupedRequirements.flatMap((g) => g.requirements), ...ungroupedRequirements].map((req) => (
                <tr key={req.id} data-testid={`requirement-row-${req.id}`}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {req.competence_code && <span className="hr-code">{req.competence_code}</span>}
                      <span>{req.competence_name}</span>
                    </div>
                  </td>
                  <td className="hr-muted">{req.group_name || "-"}</td>
                  <td>
                    <select
                      className="hr-select hr-select--sm"
                      value={req.required_level}
                      onChange={(e) => handleUpdateLevel(req.id, parseInt(e.target.value))}
                      data-testid={`select-level-${req.id}`}
                    >
                      {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={level}>Level {level}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`hr-toggle ${req.mandatory ? "hr-toggle--on" : ""}`}
                      onClick={() => handleToggleMandatory(req.id, req.mandatory)}
                      data-testid={`toggle-mandatory-${req.id}`}
                    >
                      {req.mandatory ? "Yes" : "No"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="hr-button hr-button--ghost hr-button--sm"
                      onClick={() => handleDeleteRequirement(req.id)}
                      data-testid={`button-delete-${req.id}`}
                      title="Remove Requirement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="hr-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} data-testid="modal-add-requirement">
            <div className="hr-modal__header">
              <h2 className="hr-modal__title">Add Competence Requirement</h2>
              <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="hr-modal__body">
              <div className="hr-form-field">
                <label className="hr-form-label">Competence</label>
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
                          {c.is_safety_critical ? " (Safety)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {ungroupedAvailable.length > 0 && (
                    <optgroup label="Ungrouped">
                      {ungroupedAvailable.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `[${c.code}] ` : ""}{c.name}
                          {c.is_safety_critical ? " (Safety)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Required Level (1-5)</label>
                <select
                  className="hr-select"
                  value={addForm.required_level}
                  onChange={(e) => setAddForm({ ...addForm, required_level: parseInt(e.target.value) })}
                  data-testid="select-level"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>Level {level}</option>
                  ))}
                </select>
              </div>
              <div className="hr-form-field hr-form-field--inline">
                <input
                  type="checkbox"
                  id="mandatory"
                  checked={addForm.mandatory}
                  onChange={(e) => setAddForm({ ...addForm, mandatory: e.target.checked })}
                  data-testid="checkbox-mandatory"
                />
                <label htmlFor="mandatory" className="hr-form-label">Mandatory</label>
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Notes (optional)</label>
                <textarea
                  className="hr-textarea"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="Additional notes about this requirement..."
                  data-testid="input-notes"
                />
              </div>
            </div>
            <div className="hr-modal__footer">
              <button className="hr-button hr-button--secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="hr-button hr-button--primary" onClick={handleAddRequirement} data-testid="button-save-requirement">
                Add Requirement
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
