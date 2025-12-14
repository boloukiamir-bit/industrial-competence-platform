import { 
  type User, type InsertUser,
  type Competency, type InsertCompetency,
  type Certification, type InsertCertification,
  type TrainingProgram, type InsertTrainingProgram
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCompetencies(): Promise<Competency[]>;
  getCompetency(id: string): Promise<Competency | undefined>;
  createCompetency(competency: InsertCompetency): Promise<Competency>;
  updateCompetency(id: string, competency: Partial<InsertCompetency>): Promise<Competency | undefined>;
  deleteCompetency(id: string): Promise<boolean>;
  
  getCertifications(): Promise<Certification[]>;
  getCertification(id: string): Promise<Certification | undefined>;
  getCertificationsByUser(userId: string): Promise<Certification[]>;
  createCertification(certification: InsertCertification): Promise<Certification>;
  updateCertification(id: string, certification: Partial<InsertCertification>): Promise<Certification | undefined>;
  deleteCertification(id: string): Promise<boolean>;
  
  getTrainingPrograms(): Promise<TrainingProgram[]>;
  getTrainingProgram(id: string): Promise<TrainingProgram | undefined>;
  createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram>;
  updateTrainingProgram(id: string, program: Partial<InsertTrainingProgram>): Promise<TrainingProgram | undefined>;
  deleteTrainingProgram(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private competencies: Map<string, Competency>;
  private certifications: Map<string, Certification>;
  private trainingPrograms: Map<string, TrainingProgram>;

  constructor() {
    this.users = new Map();
    this.competencies = new Map();
    this.certifications = new Map();
    this.trainingPrograms = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "employee",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getCompetencies(): Promise<Competency[]> {
    return Array.from(this.competencies.values());
  }

  async getCompetency(id: string): Promise<Competency | undefined> {
    return this.competencies.get(id);
  }

  async createCompetency(insertCompetency: InsertCompetency): Promise<Competency> {
    const id = randomUUID();
    const competency: Competency = { 
      ...insertCompetency, 
      id,
      level: insertCompetency.level || "beginner",
      description: insertCompetency.description || null
    };
    this.competencies.set(id, competency);
    return competency;
  }

  async updateCompetency(id: string, update: Partial<InsertCompetency>): Promise<Competency | undefined> {
    const existing = this.competencies.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.competencies.set(id, updated);
    return updated;
  }

  async deleteCompetency(id: string): Promise<boolean> {
    return this.competencies.delete(id);
  }

  async getCertifications(): Promise<Certification[]> {
    return Array.from(this.certifications.values());
  }

  async getCertification(id: string): Promise<Certification | undefined> {
    return this.certifications.get(id);
  }

  async getCertificationsByUser(userId: string): Promise<Certification[]> {
    return Array.from(this.certifications.values()).filter(
      (cert) => cert.userId === userId
    );
  }

  async createCertification(insertCertification: InsertCertification): Promise<Certification> {
    const id = randomUUID();
    const certification: Certification = { 
      ...insertCertification, 
      id,
      status: insertCertification.status || "valid",
      validUntil: insertCertification.validUntil || null,
      userId: insertCertification.userId || null
    };
    this.certifications.set(id, certification);
    return certification;
  }

  async updateCertification(id: string, update: Partial<InsertCertification>): Promise<Certification | undefined> {
    const existing = this.certifications.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.certifications.set(id, updated);
    return updated;
  }

  async deleteCertification(id: string): Promise<boolean> {
    return this.certifications.delete(id);
  }

  async getTrainingPrograms(): Promise<TrainingProgram[]> {
    return Array.from(this.trainingPrograms.values());
  }

  async getTrainingProgram(id: string): Promise<TrainingProgram | undefined> {
    return this.trainingPrograms.get(id);
  }

  async createTrainingProgram(insertProgram: InsertTrainingProgram): Promise<TrainingProgram> {
    const id = randomUUID();
    const program: TrainingProgram = { 
      ...insertProgram, 
      id,
      status: insertProgram.status || "draft",
      description: insertProgram.description || null,
      duration: insertProgram.duration || null,
      competencies: insertProgram.competencies || null
    };
    this.trainingPrograms.set(id, program);
    return program;
  }

  async updateTrainingProgram(id: string, update: Partial<InsertTrainingProgram>): Promise<TrainingProgram | undefined> {
    const existing = this.trainingPrograms.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.trainingPrograms.set(id, updated);
    return updated;
  }

  async deleteTrainingProgram(id: string): Promise<boolean> {
    return this.trainingPrograms.delete(id);
  }
}

export const storage = new MemStorage();
