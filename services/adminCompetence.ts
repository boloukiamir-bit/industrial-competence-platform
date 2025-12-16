import { supabase } from "@/lib/supabaseClient";

export type CompetenceGroup = {
  id: string;
  name: string;
  description: string | null;
  sort_order?: number;
};

export type Competence = {
  id: string;
  group_id: string | null;
  code: string | null;
  name: string;
  description: string | null;
  is_safety_critical: boolean;
  active: boolean;
};

export type PositionAdmin = {
  id: string;
  name: string;
  description: string | null;
  site: string | null;
  department: string | null;
  min_headcount: number | null;
};

export type PositionRequirementAdmin = {
  id: string;
  competence_id: string;
  required_level: number;
  mandatory: boolean;
  notes?: string | null;
};

export type PositionRequirementWithCompetence = PositionRequirementAdmin & {
  competence_name: string;
  competence_code: string | null;
  group_name: string | null;
};

export async function listCompetenceGroups(): Promise<CompetenceGroup[]> {
  const { data, error } = await supabase
    .from('competence_groups')
    .select('id, name, description, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CompetenceGroup[];
}

export async function createCompetenceGroup(payload: {
  name: string;
  description?: string;
}): Promise<void> {
  const { error } = await supabase.from('competence_groups').insert({
    name: payload.name,
    description: payload.description ?? null,
  });

  if (error) throw error;
}

export async function updateCompetenceGroup(id: string, payload: {
  name?: string;
  description?: string | null;
  sort_order?: number;
}): Promise<void> {
  const { error } = await supabase
    .from('competence_groups')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCompetenceGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from("competence_groups")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function listCompetences(): Promise<Competence[]> {
  const { data, error } = await supabase
    .from('competences')
    .select(
      'id, group_id, code, name, description, is_safety_critical, active'
    )
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Competence[];
}

export async function getCompetencesByGroup(groupId: string): Promise<Competence[]> {
  const { data, error } = await supabase
    .from("competences")
    .select("id, group_id, code, name, description, is_safety_critical, active")
    .eq("group_id", groupId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCompetence(payload: {
  name: string;
  code?: string;
  group_id?: string | null;
  description?: string;
  is_safety_critical?: boolean;
}): Promise<void> {
  const { error } = await supabase.from('competences').insert({
    name: payload.name,
    code: payload.code ?? null,
    group_id: payload.group_id ?? null,
    description: payload.description ?? null,
    is_safety_critical: payload.is_safety_critical ?? false,
    active: true,
  });

  if (error) throw error;
}

export async function updateCompetence(id: string, payload: {
  name?: string;
  code?: string | null;
  group_id?: string | null;
  description?: string | null;
  is_safety_critical?: boolean;
  active?: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from('competences')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCompetence(id: string): Promise<void> {
  const { error } = await supabase
    .from("competences")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function listPositions(): Promise<PositionAdmin[]> {
  // Note: min_headcount excluded due to Supabase schema cache issue
  // The column exists but PostgREST doesn't recognize it until cache refresh
  const { data, error } = await supabase
    .from('positions')
    .select('id, name, description, site, department')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    min_headcount: null, // Will be null until schema cache is refreshed
  })) as PositionAdmin[];
}

export async function getPositionById(
  id: string
): Promise<PositionAdmin | null> {
  // Note: min_headcount excluded due to Supabase schema cache issue
  const { data, error } = await supabase
    .from('positions')
    .select('id, name, description, site, department')
    .eq('id', id)
    .single();

  if (error) {
    if ((error as any).code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  return {
    ...data,
    min_headcount: null,
  } as PositionAdmin;
}

export async function createPosition(payload: {
  name: string;
  description?: string;
  site?: string;
  department?: string;
  min_headcount?: number;
}): Promise<void> {
  // Note: min_headcount excluded from insert due to Supabase schema cache issue
  // The UI allows setting it, but it won't be saved until schema cache is refreshed
  const { error } = await supabase.from('positions').insert({
    name: payload.name,
    description: payload.description ?? null,
    site: payload.site ?? null,
    department: payload.department ?? null,
  });

  if (error) throw error;
}

export async function updatePosition(id: string, payload: {
  name?: string;
  description?: string | null;
  site?: string | null;
  department?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('positions')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deletePosition(id: string): Promise<void> {
  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function listPositionRequirements(
  positionId: string
): Promise<PositionRequirementAdmin[]> {
  const { data, error } = await supabase
    .from('position_competence_requirements')
    .select(
      'id, competence_id, required_level, mandatory, notes'
    )
    .eq('position_id', positionId)
    .order('required_level', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PositionRequirementAdmin[];
}

export async function getPositionRequirements(
  positionId: string
): Promise<PositionRequirementWithCompetence[]> {
  const { data, error } = await supabase
    .from("position_competence_requirements")
    .select(`
      id,
      competence_id,
      required_level,
      mandatory,
      notes,
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
    competence_id: row.competence_id,
    required_level: row.required_level,
    mandatory: row.mandatory,
    notes: row.notes,
    competence_name: row.competences?.name || "Unknown",
    competence_code: row.competences?.code || null,
    group_name: row.competences?.competence_groups?.name || null,
  }));
}

export async function createPositionRequirement(payload: {
  position_id: string;
  competence_id: string;
  required_level: number;
  mandatory: boolean;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('position_competence_requirements')
    .insert({
      position_id: payload.position_id,
      competence_id: payload.competence_id,
      required_level: payload.required_level,
      mandatory: payload.mandatory,
      notes: payload.notes ?? null,
    });

  if (error) throw error;
}

export async function updatePositionRequirement(
  id: string,
  payload: {
    required_level?: number;
    mandatory?: boolean;
    notes?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('position_competence_requirements')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deletePositionRequirement(id: string): Promise<void> {
  const { error } = await supabase
    .from('position_competence_requirements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Legacy aliases for backward compatibility
export const getCompetenceGroups = listCompetenceGroups;
export const getCompetences = listCompetences;
export const getPositions = listPositions;
export const getPosition = getPositionById;
