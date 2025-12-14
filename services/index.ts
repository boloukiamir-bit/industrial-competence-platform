import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Competency, Certification, TrainingProgram } from "@/types";

export async function getCompetencies(): Promise<Competency[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from("competencies").select("*");
  if (error) throw error;
  return data || [];
}

export async function getCertifications(): Promise<Certification[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from("certifications").select("*");
  if (error) throw error;
  return data || [];
}

export async function getTrainingPrograms(): Promise<TrainingProgram[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from("training_programs").select("*");
  if (error) throw error;
  return data || [];
}
