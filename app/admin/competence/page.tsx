"use client";

import { useState, useEffect } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  listCompetenceGroups,
  listCompetences,
  createCompetenceGroup,
  updateCompetenceGroup,
  createCompetence,
  updateCompetence,
  CompetenceGroup,
  Competence,
} from "@/services/adminCompetence";
import { Plus, Pencil, Shield, Check, X } from "lucide-react";

export default function CompetenceAdminPage() {
  const { loading: authLoading } = useAuthGuard();
  const [groups, setGroups] = useState<CompetenceGroup[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [showAddGroup, setShowAddGroup] = useState(false);

  const [editingCompetenceId, setEditingCompetenceId] = useState<string | null>(null);
  const [competenceForm, setCompetenceForm] = useState({
    name: "",
    code: "",
    group_id: "",
    description: "",
    is_safety_critical: false,
  });
  const [showAddCompetence, setShowAddCompetence] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  async function loadData() {
    try {
      setLoading(true);
      const [groupsData, competencesData] = await Promise.all([
        listCompetenceGroups(),
        listCompetences(),
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

  function startEditGroup(group: CompetenceGroup) {
    setEditingGroupId(group.id);
    setGroupForm({ name: group.name, description: group.description || "" });
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setGroupForm({ name: "", description: "" });
  }

  async function handleSaveGroup() {
    try {
      if (editingGroupId) {
        await updateCompetenceGroup(editingGroupId, {
          name: groupForm.name,
          description: groupForm.description || null,
        });
        setEditingGroupId(null);
      } else {
        await createCompetenceGroup({
          name: groupForm.name,
          description: groupForm.description || undefined,
        });
        setShowAddGroup(false);
      }
      setGroupForm({ name: "", description: "" });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save group");
    }
  }

  function startEditCompetence(comp: Competence) {
    setEditingCompetenceId(comp.id);
    setCompetenceForm({
      name: comp.name,
      code: comp.code || "",
      group_id: comp.group_id || "",
      description: comp.description || "",
      is_safety_critical: comp.is_safety_critical,
    });
  }

  function cancelEditCompetence() {
    setEditingCompetenceId(null);
    setCompetenceForm({ name: "", code: "", group_id: "", description: "", is_safety_critical: false });
  }

  async function handleSaveCompetence() {
    try {
      if (editingCompetenceId) {
        await updateCompetence(editingCompetenceId, {
          name: competenceForm.name,
          code: competenceForm.code || null,
          group_id: competenceForm.group_id || null,
          description: competenceForm.description || null,
          is_safety_critical: competenceForm.is_safety_critical,
        });
        setEditingCompetenceId(null);
      } else {
        await createCompetence({
          name: competenceForm.name,
          code: competenceForm.code || undefined,
          group_id: competenceForm.group_id || null,
          description: competenceForm.description || undefined,
          is_safety_critical: competenceForm.is_safety_critical,
        });
        setShowAddCompetence(false);
      }
      setCompetenceForm({ name: "", code: "", group_id: "", description: "", is_safety_critical: false });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save competence");
    }
  }

  async function handleToggleActive(comp: Competence) {
    try {
      await updateCompetence(comp.id, { active: !comp.active });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to update competence");
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

  if (error) {
    return (
      <main className="hr-page">
        <p className="hr-error">{error}</p>
      </main>
    );
  }

  const filteredCompetences = selectedGroupFilter === "all"
    ? competences
    : selectedGroupFilter === "ungrouped"
    ? competences.filter((c) => !c.group_id)
    : competences.filter((c) => c.group_id === selectedGroupFilter);

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "-";
    const group = groups.find((g) => g.id === groupId);
    return group?.name || "-";
  };

  return (
    <main className="hr-page">
      <div className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Competence Admin</h1>
          <p className="hr-page__subtitle">Manage competence groups and competences used in matrices and gaps.</p>
        </div>
      </div>

      <nav className="hr-breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/app/hr/tasks" className="hr-breadcrumb__link">Dashboard</Link>
        <span className="hr-breadcrumb__separator">/</span>
        <span>Competence Admin</span>
      </nav>

      <div className="admin-grid">
        <div className="hr-card" data-testid="panel-groups">
          <div className="hr-section__title" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hr-border)" }}>
            Groups
          </div>
          <div style={{ padding: 16 }}>
            {groups.map((group) => (
              <div key={group.id} data-testid={`group-row-${group.id}`}>
                {editingGroupId === group.id ? (
                  <div style={{ marginBottom: 12, padding: 12, background: "var(--hr-bg-secondary)", borderRadius: 8 }}>
                    <div className="hr-form-field">
                      <input
                        type="text"
                        className="hr-input"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                        placeholder="Group name"
                        data-testid="input-edit-group-name"
                      />
                    </div>
                    <div className="hr-form-field">
                      <input
                        type="text"
                        className="hr-input"
                        value={groupForm.description}
                        onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                        placeholder="Description (optional)"
                        data-testid="input-edit-group-description"
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="hr-button hr-button--primary hr-button--sm" onClick={handleSaveGroup} data-testid="button-save-edit-group">
                        <Check size={14} /> Save
                      </button>
                      <button className="hr-button hr-button--ghost hr-button--sm" onClick={cancelEditGroup}>
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--hr-border-light)" }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{group.name}</div>
                      {group.description && <div className="hr-muted" style={{ fontSize: 13 }}>{group.description}</div>}
                    </div>
                    <button
                      className="hr-button hr-button--ghost hr-button--sm"
                      onClick={() => startEditGroup(group)}
                      data-testid={`button-edit-group-${group.id}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {groups.length === 0 && !showAddGroup && (
              <p className="hr-muted" style={{ padding: "12px 0" }}>No groups yet.</p>
            )}

            {showAddGroup ? (
              <div style={{ marginTop: 12, padding: 12, background: "var(--hr-bg-secondary)", borderRadius: 8 }}>
                <div className="hr-form-field">
                  <input
                    type="text"
                    className="hr-input"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder="Group name"
                    data-testid="input-new-group-name"
                  />
                </div>
                <div className="hr-form-field">
                  <input
                    type="text"
                    className="hr-input"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder="Description (optional)"
                    data-testid="input-new-group-description"
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="hr-button hr-button--primary hr-button--sm" onClick={handleSaveGroup} data-testid="button-save-new-group">
                    <Check size={14} /> Add
                  </button>
                  <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => { setShowAddGroup(false); setGroupForm({ name: "", description: "" }); }}>
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="hr-button hr-button--secondary hr-button--sm"
                onClick={() => setShowAddGroup(true)}
                style={{ marginTop: 12 }}
                data-testid="button-new-group"
              >
                <Plus size={14} /> Add Group
              </button>
            )}
          </div>
        </div>

        <div className="hr-card" data-testid="panel-competences">
          <div className="hr-section__title" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hr-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span>Competences</span>
            <select
              className="hr-select"
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              style={{ width: "auto", minWidth: 150 }}
              data-testid="select-group-filter"
            >
              <option value="all">All Groups</option>
              <option value="ungrouped">Ungrouped</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div style={{ padding: 16 }}>
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Group</th>
                  <th>Safety</th>
                  <th>Active</th>
                  <th style={{ width: 60 }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompetences.map((comp) => (
                  <tr key={comp.id} data-testid={`competence-row-${comp.id}`}>
                    {editingCompetenceId === comp.id ? (
                      <td colSpan={6}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "8px 0" }}>
                          <div className="hr-form-field">
                            <label className="hr-form-label">Name</label>
                            <input
                              type="text"
                              className="hr-input"
                              value={competenceForm.name}
                              onChange={(e) => setCompetenceForm({ ...competenceForm, name: e.target.value })}
                              data-testid="input-edit-competence-name"
                            />
                          </div>
                          <div className="hr-form-field">
                            <label className="hr-form-label">Code</label>
                            <input
                              type="text"
                              className="hr-input"
                              value={competenceForm.code}
                              onChange={(e) => setCompetenceForm({ ...competenceForm, code: e.target.value })}
                              data-testid="input-edit-competence-code"
                            />
                          </div>
                          <div className="hr-form-field">
                            <label className="hr-form-label">Group</label>
                            <select
                              className="hr-select"
                              value={competenceForm.group_id}
                              onChange={(e) => setCompetenceForm({ ...competenceForm, group_id: e.target.value })}
                              data-testid="select-edit-competence-group"
                            >
                              <option value="">No Group</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="hr-form-field">
                            <label className="hr-form-label">Description</label>
                            <input
                              type="text"
                              className="hr-input"
                              value={competenceForm.description}
                              onChange={(e) => setCompetenceForm({ ...competenceForm, description: e.target.value })}
                              data-testid="input-edit-competence-description"
                            />
                          </div>
                          <div className="hr-form-field hr-form-field--inline">
                            <input
                              type="checkbox"
                              id="edit-safety-critical"
                              checked={competenceForm.is_safety_critical}
                              onChange={(e) => setCompetenceForm({ ...competenceForm, is_safety_critical: e.target.checked })}
                              data-testid="checkbox-edit-safety-critical"
                            />
                            <label htmlFor="edit-safety-critical" className="hr-form-label">Safety Critical</label>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                            <button className="hr-button hr-button--primary hr-button--sm" onClick={handleSaveCompetence} data-testid="button-save-edit-competence">
                              <Check size={14} /> Save
                            </button>
                            <button className="hr-button hr-button--ghost hr-button--sm" onClick={cancelEditCompetence}>
                              <X size={14} /> Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {comp.is_safety_critical && <Shield size={14} className="hr-icon--warning" />}
                            {comp.name}
                          </div>
                        </td>
                        <td>{comp.code || "-"}</td>
                        <td>{getGroupName(comp.group_id)}</td>
                        <td>{comp.is_safety_critical ? "Yes" : "No"}</td>
                        <td>
                          <button
                            className={`hr-toggle ${comp.active ? "hr-toggle--on" : "hr-toggle--off"}`}
                            onClick={() => handleToggleActive(comp)}
                            data-testid={`toggle-active-${comp.id}`}
                            title={comp.active ? "Active" : "Inactive"}
                          >
                            {comp.active ? <Check size={12} /> : <X size={12} />}
                          </button>
                        </td>
                        <td>
                          <button
                            className="hr-button hr-button--ghost hr-button--sm"
                            onClick={() => startEditCompetence(comp)}
                            data-testid={`button-edit-competence-${comp.id}`}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredCompetences.length === 0 && !showAddCompetence && (
                  <tr>
                    <td colSpan={6} className="hr-muted" style={{ textAlign: "center", padding: 24 }}>
                      No competences found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {showAddCompetence ? (
              <div style={{ marginTop: 16, padding: 16, background: "var(--hr-bg-secondary)", borderRadius: 8 }}>
                <h4 className="hr-section__title" style={{ marginBottom: 12 }}>Add Competence</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="hr-form-field">
                    <label className="hr-form-label">Name *</label>
                    <input
                      type="text"
                      className="hr-input"
                      value={competenceForm.name}
                      onChange={(e) => setCompetenceForm({ ...competenceForm, name: e.target.value })}
                      data-testid="input-new-competence-name"
                    />
                  </div>
                  <div className="hr-form-field">
                    <label className="hr-form-label">Code</label>
                    <input
                      type="text"
                      className="hr-input"
                      value={competenceForm.code}
                      onChange={(e) => setCompetenceForm({ ...competenceForm, code: e.target.value })}
                      placeholder="e.g., CNC, WLD"
                      data-testid="input-new-competence-code"
                    />
                  </div>
                  <div className="hr-form-field">
                    <label className="hr-form-label">Group</label>
                    <select
                      className="hr-select"
                      value={competenceForm.group_id}
                      onChange={(e) => setCompetenceForm({ ...competenceForm, group_id: e.target.value })}
                      data-testid="select-new-competence-group"
                    >
                      <option value="">No Group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="hr-form-field">
                    <label className="hr-form-label">Description</label>
                    <input
                      type="text"
                      className="hr-input"
                      value={competenceForm.description}
                      onChange={(e) => setCompetenceForm({ ...competenceForm, description: e.target.value })}
                      data-testid="input-new-competence-description"
                    />
                  </div>
                  <div className="hr-form-field hr-form-field--inline">
                    <input
                      type="checkbox"
                      id="new-safety-critical"
                      checked={competenceForm.is_safety_critical}
                      onChange={(e) => setCompetenceForm({ ...competenceForm, is_safety_critical: e.target.checked })}
                      data-testid="checkbox-new-safety-critical"
                    />
                    <label htmlFor="new-safety-critical" className="hr-form-label">Safety Critical</label>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <button className="hr-button hr-button--primary hr-button--sm" onClick={handleSaveCompetence} data-testid="button-save-new-competence">
                      <Check size={14} /> Add
                    </button>
                    <button className="hr-button hr-button--ghost hr-button--sm" onClick={() => { setShowAddCompetence(false); setCompetenceForm({ name: "", code: "", group_id: "", description: "", is_safety_critical: false }); }}>
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="hr-button hr-button--primary hr-button--sm"
                onClick={() => setShowAddCompetence(true)}
                style={{ marginTop: 16 }}
                data-testid="button-new-competence"
              >
                <Plus size={14} /> Add Competence
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
