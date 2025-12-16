import { supabase } from "@/lib/supabaseClient";

export type CompetenceGroup = {
  id: string;
  name: string;
  description: string | null;
};

export type Competence = {
  id: string;
  group_id: string | null;
  code: string | null;
  name: string;
  description: string | null;
  is_safety_critical: boolean;
};

export type PositionAdmin = {
  id: string;
  name: string;
  description: string | null;
  site: string | null;
  department: string | null;
};

export type PositionRequirementAdmin = {
  id: string;
  position_id: string;
  competence_id: string;
  required_level: number;
  mandatory: boolean;
};

export type PositionRequirementWithCompetence = PositionRequirementAdmin & {
  competence_name: string;
  competence_code: string | null;
  group_name: string | null;
};

export async function getCompetenceGroups(): Promise<CompetenceGroup[]> {
  const { data, error } = await supabase
    .from("competence_groups")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCompetenceGroup(
  group: Omit<CompetenceGroup, "id">
): Promise<CompetenceGroup> {
  const { data, error } = await supabase
    .from("competence_groups")
    .insert(group)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompetenceGroup(
  id: string,
  updates: Partial<Omit<CompetenceGroup, "id">>
): Promise<CompetenceGroup> {
  const { data, error } = await supabase
    .from("competence_groups")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompetenceGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from("competence_groups")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getCompetences(): Promise<Competence[]> {
  const { data, error } = await supabase
    .from("competences")
    .select("id, group_id, code, name, description, is_safety_critical")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCompetencesByGroup(groupId: string): Promise<Competence[]> {
  const { data, error } = await supabase
    .from("competences")
    .select("id, group_id, code, name, description, is_safety_critical")
    .eq("group_id", groupId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCompetence(
  competence: Omit<Competence, "id">
): Promise<Competence> {
  const { data, error } = await supabase
    .from("competences")
    .insert(competence)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompetence(
  id: string,
  updates: Partial<Omit<Competence, "id">>
): Promise<Competence> {
  const { data, error } = await supabase
    .from("competences")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompetence(id: string): Promise<void> {
  const { error } = await supabase
    .from("competences")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getPositions(): Promise<PositionAdmin[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("id, name, description, site, department")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getPosition(id: string): Promise<PositionAdmin | null> {
  const { data, error } = await supabase
    .from("positions")
    .select("id, name, description, site, department")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function createPosition(
  position: Omit<PositionAdmin, "id">
): Promise<PositionAdmin> {
  const { data, error } = await supabase
    .from("positions")
    .insert(position)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePosition(
  id: string,
  updates: Partial<Omit<PositionAdmin, "id">>
): Promise<PositionAdmin> {
  const { data, error } = await supabase
    .from("positions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePosition(id: string): Promise<void> {
  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getPositionRequirements(
  positionId: string
): Promise<PositionRequirementWithCompetence[]> {
  const { data, error } = await supabase
    .from("position_competence_requirements")
    .select(`
      id,
      position_id,
      competence_id,
      required_level,
      mandatory,
      competences (
        name,
        code,
        competence_groups (
          name
        )
      )
    `)
    .eq("position_id", positionId);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    position_id: row.position_id,
    competence_id: row.competence_id,
    required_level: row.required_level,
    mandatory: row.mandatory,
    competence_name: row.competences?.name || "Unknown",
    competence_code: row.competences?.code || null,
    group_name: row.competences?.competence_groups?.name || null,
  }));
}

export async function createPositionRequirement(
  requirement: Omit<PositionRequirementAdmin, "id">
): Promise<PositionRequirementAdmin> {
  const { data, error } = await supabase
    .from("position_competence_requirements")
    .insert(requirement)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePositionRequirement(
  id: string,
  updates: Partial<Omit<PositionRequirementAdmin, "id" | "position_id" | "competence_id">>
): Promise<PositionRequirementAdmin> {
  const { data, error } = await supabase
    .from("position_competence_requirements")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePositionRequirement(id: string): Promise<void> {
  const { error } = await supabase
    .from("position_competence_requirements")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
