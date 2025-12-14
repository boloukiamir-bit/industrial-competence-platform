import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").default("employee"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const competencies = pgTable("competencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  level: text("level").notNull().default("beginner"),
});

export const certifications = pgTable("certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  issuingOrganization: text("issuing_organization").notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until"),
  status: text("status").notNull().default("valid"),
  userId: varchar("user_id").references(() => users.id),
});

export const trainingPrograms = pgTable("training_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  duration: text("duration"),
  competencies: text("competencies").array(),
  status: text("status").notNull().default("draft"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCompetencySchema = createInsertSchema(competencies).omit({
  id: true,
});

export const insertCertificationSchema = createInsertSchema(certifications).omit({
  id: true,
});

export const insertTrainingProgramSchema = createInsertSchema(trainingPrograms).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCompetency = z.infer<typeof insertCompetencySchema>;
export type Competency = typeof competencies.$inferSelect;

export type InsertCertification = z.infer<typeof insertCertificationSchema>;
export type Certification = typeof certifications.$inferSelect;

export type InsertTrainingProgram = z.infer<typeof insertTrainingProgramSchema>;
export type TrainingProgram = typeof trainingPrograms.$inferSelect;
