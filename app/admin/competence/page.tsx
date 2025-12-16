"use client";

import { useState, useEffect } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  getCompetenceGroups,
  getCompetences,
  createCompetenceGroup,
  updateCompetenceGroup,
  deleteCompetenceGroup,
  createCompetence,
  updateCompetence,
  deleteCompetence,
  CompetenceGroup,
  Competence,
} from "@/services/adminCompetence";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Shield, X } from "lucide-react";

type EditingGroup = CompetenceGroup | null;
type EditingCompetence = Competence | null;

export default function CompetenceAdminPage() {
  const { loading: authLoading } = useAuthGuard();
  const [groups, setGroups] = useState<CompetenceGroup[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EditingGroup>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  
  const [showCompetenceModal, setShowCompetenceModal] = useState(false);
  const [editingCompetence, setEditingCompetence] = useState<EditingCompetence>(null);
  const [competenceForm, setCompetenceForm] = useState({
    group_id: "",
    code: "",
    name: "",
    description: "",
    is_safety_critical: false,
  });

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  async function loadData() {
    try {
      setLoading(true);
      const [groupsData, competencesData] = await Promise.all([
        getCompetenceGroups(),
        getCompetences(),
      ]);
      setGroups(groupsData);
      setCompetences(competencesData);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function openNewGroupModal() {
    setEditingGroup(null);
    setGroupForm({ name: "", description: "" });
    setShowGroupModal(true);
  }

  function openEditGroupModal(group: CompetenceGroup) {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || "",
    });
    setShowGroupModal(true);
  }

  async function handleSaveGroup() {
    try {
      if (editingGroup) {
        await updateCompetenceGroup(editingGroup.id, {
          name: groupForm.name,
          description: groupForm.description || null,
        });
      } else {
        await createCompetenceGroup({
          name: groupForm.name,
          description: groupForm.description || undefined,
        });
      }
      setShowGroupModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save group");
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Delete this group? All competences in this group will become ungrouped.")) return;
    try {
      await deleteCompetenceGroup(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete group");
    }
  }

  function openNewCompetenceModal(groupId?: string) {
    setEditingCompetence(null);
    setCompetenceForm({
      group_id: groupId || "",
      code: "",
      name: "",
      description: "",
      is_safety_critical: false,
    });
    setShowCompetenceModal(true);
  }

  function openEditCompetenceModal(comp: Competence) {
    setEditingCompetence(comp);
    setCompetenceForm({
      group_id: comp.group_id || "",
      code: comp.code || "",
      name: comp.name,
      description: comp.description || "",
      is_safety_critical: comp.is_safety_critical,
    });
    setShowCompetenceModal(true);
  }

  async function handleSaveCompetence() {
    try {
      if (editingCompetence) {
        await updateCompetence(editingCompetence.id, {
          group_id: competenceForm.group_id || null,
          code: competenceForm.code || null,
          name: competenceForm.name,
          description: competenceForm.description || null,
          is_safety_critical: competenceForm.is_safety_critical,
        });
      } else {
        await createCompetence({
          name: competenceForm.name,
          code: competenceForm.code || undefined,
          group_id: competenceForm.group_id || null,
          description: competenceForm.description || undefined,
          is_safety_critical: competenceForm.is_safety_critical,
        });
      }
      setShowCompetenceModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save competence");
    }
  }

  async function handleDeleteCompetence(id: string) {
    if (!confirm("Delete this competence? This may affect position requirements.")) return;
    try {
      await deleteCompetence(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete competence");
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

  const ungroupedCompetences = competences.filter((c) => !c.group_id);

  return (
    <main className="hr-page">
      <div className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Competence Admin</h1>
          <p className="hr-page__subtitle">Manage competence groups and competences</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="hr-button hr-button--secondary"
            onClick={openNewGroupModal}
            data-testid="button-new-group"
          >
            <Plus size={16} /> New Group
          </button>
          <button
            className="hr-button hr-button--primary"
            onClick={() => openNewCompetenceModal()}
            data-testid="button-new-competence"
          >
            <Plus size={16} /> New Competence
          </button>
        </div>
      </div>

      <nav className="hr-breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/app/hr/tasks" className="hr-breadcrumb__link">Dashboard</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <span>Competence Admin</span>
      </nav>

      <div className="hr-card">
        {groups.map((group) => {
          const groupCompetences = competences.filter((c) => c.group_id === group.id);
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id} className="hr-admin-group" data-testid={`group-${group.id}`}>
              <div
                className="hr-admin-group__header"
                onClick={() => toggleGroup(group.id)}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--hr-border)" }}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span style={{ fontWeight: 600, flex: 1 }}>{group.name}</span>
                <span className="hr-badge hr-badge--secondary" style={{ marginRight: 8 }}>
                  {groupCompetences.length} competences
                </span>
                <button
                  className="hr-button hr-button--ghost hr-button--sm"
                  onClick={(e) => { e.stopPropagation(); openEditGroupModal(group); }}
                  data-testid={`button-edit-group-${group.id}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="hr-button hr-button--ghost hr-button--sm"
                  onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                  data-testid={`button-delete-group-${group.id}`}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  className="hr-button hr-button--ghost hr-button--sm"
                  onClick={(e) => { e.stopPropagation(); openNewCompetenceModal(group.id); }}
                  data-testid={`button-add-competence-${group.id}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {isExpanded && (
                <div style={{ paddingLeft: 28 }}>
                  {groupCompetences.length === 0 ? (
                    <p className="hr-muted" style={{ padding: "12px 0" }}>No competences in this group</p>
                  ) : (
                    groupCompetences.map((comp) => (
                      <div
                        key={comp.id}
                        className="hr-admin-item"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--hr-border-light)" }}
                        data-testid={`competence-${comp.id}`}
                      >
                        {comp.is_safety_critical && <Shield size={14} className="hr-icon--warning" />}
                        <span style={{ flex: 1 }}>
                          {comp.code && <span className="hr-code">{comp.code}</span>} {comp.name}
                        </span>
                        <button
                          className="hr-button hr-button--ghost hr-button--sm"
                          onClick={() => openEditCompetenceModal(comp)}
                          data-testid={`button-edit-competence-${comp.id}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="hr-button hr-button--ghost hr-button--sm"
                          onClick={() => handleDeleteCompetence(comp.id)}
                          data-testid={`button-delete-competence-${comp.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {ungroupedCompetences.length > 0 && (
          <div className="hr-admin-group" data-testid="group-ungrouped">
            <div style={{ padding: "12px 0", borderBottom: "1px solid var(--hr-border)" }}>
              <span style={{ fontWeight: 600, color: "var(--hr-text-secondary)" }}>Ungrouped Competences</span>
              <span className="hr-badge hr-badge--muted" style={{ marginLeft: 8 }}>
                {ungroupedCompetences.length}
              </span>
            </div>
            <div style={{ paddingLeft: 28 }}>
              {ungroupedCompetences.map((comp) => (
                <div
                  key={comp.id}
                  className="hr-admin-item"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--hr-border-light)" }}
                  data-testid={`competence-${comp.id}`}
                >
                  {comp.is_safety_critical && <Shield size={14} className="hr-icon--warning" />}
                  <span style={{ flex: 1 }}>
                    {comp.code && <span className="hr-code">{comp.code}</span>} {comp.name}
                  </span>
                  <button
                    className="hr-button hr-button--ghost hr-button--sm"
                    onClick={() => openEditCompetenceModal(comp)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="hr-button hr-button--ghost hr-button--sm"
                    onClick={() => handleDeleteCompetence(comp.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.length === 0 && ungroupedCompetences.length === 0 && (
          <p className="hr-muted" style={{ padding: 24, textAlign: "center" }}>
            No competence groups or competences yet. Create a group to get started.
          </p>
        )}
      </div>

      {showGroupModal && (
        <div className="hr-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} data-testid="modal-group">
            <div className="hr-modal__header">
              <h2 className="hr-modal__title">{editingGroup ? "Edit Group" : "New Group"}</h2>
              <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => setShowGroupModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="hr-modal__body">
              <div className="hr-form-field">
                <label className="hr-form-label">Name</label>
                <input
                  type="text"
                  className="hr-input"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  data-testid="input-group-name"
                />
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Description</label>
                <textarea
                  className="hr-textarea"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  data-testid="input-group-description"
                />
              </div>
            </div>
            <div className="hr-modal__footer">
              <button className="hr-button hr-button--secondary" onClick={() => setShowGroupModal(false)}>
                Cancel
              </button>
              <button className="hr-button hr-button--primary" onClick={handleSaveGroup} data-testid="button-save-group">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompetenceModal && (
        <div className="hr-modal-overlay" onClick={() => setShowCompetenceModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} data-testid="modal-competence">
            <div className="hr-modal__header">
              <h2 className="hr-modal__title">{editingCompetence ? "Edit Competence" : "New Competence"}</h2>
              <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => setShowCompetenceModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="hr-modal__body">
              <div className="hr-form-field">
                <label className="hr-form-label">Group</label>
                <select
                  className="hr-select"
                  value={competenceForm.group_id}
                  onChange={(e) => setCompetenceForm({ ...competenceForm, group_id: e.target.value })}
                  data-testid="select-competence-group"
                >
                  <option value="">No Group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Code</label>
                <input
                  type="text"
                  className="hr-input"
                  value={competenceForm.code}
                  onChange={(e) => setCompetenceForm({ ...competenceForm, code: e.target.value })}
                  placeholder="e.g., CNC, WLD"
                  data-testid="input-competence-code"
                />
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Name</label>
                <input
                  type="text"
                  className="hr-input"
                  value={competenceForm.name}
                  onChange={(e) => setCompetenceForm({ ...competenceForm, name: e.target.value })}
                  data-testid="input-competence-name"
                />
              </div>
              <div className="hr-form-field">
                <label className="hr-form-label">Description</label>
                <textarea
                  className="hr-textarea"
                  value={competenceForm.description}
                  onChange={(e) => setCompetenceForm({ ...competenceForm, description: e.target.value })}
                  data-testid="input-competence-description"
                />
              </div>
              <div className="hr-form-field hr-form-field--inline">
                <input
                  type="checkbox"
                  id="is_safety_critical"
                  checked={competenceForm.is_safety_critical}
                  onChange={(e) => setCompetenceForm({ ...competenceForm, is_safety_critical: e.target.checked })}
                  data-testid="checkbox-safety-critical"
                />
                <label htmlFor="is_safety_critical" className="hr-form-label">Safety Critical</label>
              </div>
            </div>
            <div className="hr-modal__footer">
              <button className="hr-button hr-button--secondary" onClick={() => setShowCompetenceModal(false)}>
                Cancel
              </button>
              <button className="hr-button hr-button--primary" onClick={handleSaveCompetence} data-testid="button-save-competence">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
