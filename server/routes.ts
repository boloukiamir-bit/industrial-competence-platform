import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCompetencySchema, 
  insertCertificationSchema, 
  insertTrainingProgramSchema 
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/competencies", async (req, res) => {
    try {
      const competencies = await storage.getCompetencies();
      res.json(competencies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch competencies" });
    }
  });

  app.get("/api/competencies/:id", async (req, res) => {
    try {
      const competency = await storage.getCompetency(req.params.id);
      if (!competency) {
        return res.status(404).json({ error: "Competency not found" });
      }
      res.json(competency);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch competency" });
    }
  });

  app.post("/api/competencies", async (req, res) => {
    try {
      const parsed = insertCompetencySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const competency = await storage.createCompetency(parsed.data);
      res.status(201).json(competency);
    } catch (error) {
      res.status(500).json({ error: "Failed to create competency" });
    }
  });

  app.patch("/api/competencies/:id", async (req, res) => {
    try {
      const parsed = insertCompetencySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const competency = await storage.updateCompetency(req.params.id, parsed.data);
      if (!competency) {
        return res.status(404).json({ error: "Competency not found" });
      }
      res.json(competency);
    } catch (error) {
      res.status(500).json({ error: "Failed to update competency" });
    }
  });

  app.delete("/api/competencies/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCompetency(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Competency not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete competency" });
    }
  });

  app.get("/api/certifications", async (req, res) => {
    try {
      const certifications = await storage.getCertifications();
      res.json(certifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certifications" });
    }
  });

  app.get("/api/certifications/:id", async (req, res) => {
    try {
      const certification = await storage.getCertification(req.params.id);
      if (!certification) {
        return res.status(404).json({ error: "Certification not found" });
      }
      res.json(certification);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certification" });
    }
  });

  app.post("/api/certifications", async (req, res) => {
    try {
      const parsed = insertCertificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const certification = await storage.createCertification(parsed.data);
      res.status(201).json(certification);
    } catch (error) {
      res.status(500).json({ error: "Failed to create certification" });
    }
  });

  app.patch("/api/certifications/:id", async (req, res) => {
    try {
      const parsed = insertCertificationSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const certification = await storage.updateCertification(req.params.id, parsed.data);
      if (!certification) {
        return res.status(404).json({ error: "Certification not found" });
      }
      res.json(certification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update certification" });
    }
  });

  app.delete("/api/certifications/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCertification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Certification not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete certification" });
    }
  });

  app.get("/api/training-programs", async (req, res) => {
    try {
      const programs = await storage.getTrainingPrograms();
      res.json(programs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training programs" });
    }
  });

  app.get("/api/training-programs/:id", async (req, res) => {
    try {
      const program = await storage.getTrainingProgram(req.params.id);
      if (!program) {
        return res.status(404).json({ error: "Training program not found" });
      }
      res.json(program);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training program" });
    }
  });

  app.post("/api/training-programs", async (req, res) => {
    try {
      const parsed = insertTrainingProgramSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const program = await storage.createTrainingProgram(parsed.data);
      res.status(201).json(program);
    } catch (error) {
      res.status(500).json({ error: "Failed to create training program" });
    }
  });

  app.patch("/api/training-programs/:id", async (req, res) => {
    try {
      const parsed = insertTrainingProgramSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const program = await storage.updateTrainingProgram(req.params.id, parsed.data);
      if (!program) {
        return res.status(404).json({ error: "Training program not found" });
      }
      res.json(program);
    } catch (error) {
      res.status(500).json({ error: "Failed to update training program" });
    }
  });

  app.delete("/api/training-programs/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTrainingProgram(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Training program not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete training program" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
