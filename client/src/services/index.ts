import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, Competency, Certification, TrainingProgram, ApiResponse } from '@/types';

export const authService = {
  async signUp(email: string, password: string): Promise<ApiResponse<User>> {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { data: data.user as unknown as User };
  },

  async signIn(email: string, password: string): Promise<ApiResponse<User>> {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { data: data.user as unknown as User };
  },

  async signOut(): Promise<ApiResponse<void>> {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    return { message: 'Signed out successfully' };
  },

  async getCurrentUser(): Promise<ApiResponse<User | null>> {
    if (!isSupabaseConfigured()) {
      return { data: null };
    }
    const { data: { user } } = await supabase.auth.getUser();
    return { data: user as unknown as User | null };
  }
};

export const competencyService = {
  async getAll(): Promise<ApiResponse<Competency[]>> {
    return { data: [] };
  },

  async getById(id: string): Promise<ApiResponse<Competency | null>> {
    return { data: null };
  },

  async create(competency: Omit<Competency, 'id'>): Promise<ApiResponse<Competency>> {
    return { error: 'Not implemented' };
  },

  async update(id: string, competency: Partial<Competency>): Promise<ApiResponse<Competency>> {
    return { error: 'Not implemented' };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return { error: 'Not implemented' };
  }
};

export const certificationService = {
  async getAll(): Promise<ApiResponse<Certification[]>> {
    return { data: [] };
  },

  async getById(id: string): Promise<ApiResponse<Certification | null>> {
    return { data: null };
  },

  async create(certification: Omit<Certification, 'id'>): Promise<ApiResponse<Certification>> {
    return { error: 'Not implemented' };
  },

  async update(id: string, certification: Partial<Certification>): Promise<ApiResponse<Certification>> {
    return { error: 'Not implemented' };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return { error: 'Not implemented' };
  }
};

export const trainingService = {
  async getAll(): Promise<ApiResponse<TrainingProgram[]>> {
    return { data: [] };
  },

  async getById(id: string): Promise<ApiResponse<TrainingProgram | null>> {
    return { data: null };
  },

  async create(program: Omit<TrainingProgram, 'id'>): Promise<ApiResponse<TrainingProgram>> {
    return { error: 'Not implemented' };
  },

  async update(id: string, program: Partial<TrainingProgram>): Promise<ApiResponse<TrainingProgram>> {
    return { error: 'Not implemented' };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return { error: 'Not implemented' };
  }
};
