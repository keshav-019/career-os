import { Router } from "express";
import type { JobRecord, ResumeVersion } from "@careeros/shared";
import {
  generateAtsResumeWithAi,
  generateLearningPlanWithAi,
  matchJobWithAi,
  reviewResumeWithAi,
  type LearningPlanTrackInput,
  type LearningPlanWeakRowInput
} from "@/lib/ai/career-ai";
import { sanitizeProfileData } from "@/lib/profile-data";
import { requireAuthAndRateLimit } from "../lib/require-auth-rate-limit";

/**
 * Express port of apps/web/src/app/api/ai/{job-match,resume-review,generate-resume,learning-plan}/route.ts.
 * Unlike interview/system-design, these routes never touch Firestore/firebase-admin - their only problem on
 * Vercel was apps/web/src/proxy.ts gating all of /api/ai/* behind a desktop-only build flag, which doesn't apply
 * here since this backend serves the phone directly. See apps/mobile-backend/README.md.
 */

const router = Router();

router.post("/job-match", async (req, res) => {
  const auth = await requireAuthAndRateLimit(req, res, "ai-job-match");
  if (!auth) return;

  try {
    const body = req.body as { job?: Partial<JobRecord> & Record<string, unknown>; resumes?: ResumeVersion[] };

    if (!body.job) {
      return res.status(400).json({ error: "A job payload is required." });
    }
    if (!Array.isArray(body.resumes) || body.resumes.length === 0) {
      return res.status(400).json({ error: "At least one resume is required." });
    }

    const { model: _model, ...match } = await matchJobWithAi(body.job, body.resumes);
    res.json({ match, ok: true });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to analyze job fit." });
  }
});

router.post("/resume-review", async (req, res) => {
  const auth = await requireAuthAndRateLimit(req, res, "ai-resume-review");
  if (!auth) return;

  try {
    const body = req.body as { resume?: ResumeVersion };

    if (!body.resume?.id) {
      return res.status(400).json({ error: "A resume payload is required." });
    }

    const { model: _model, ...review } = await reviewResumeWithAi(body.resume);
    res.json({ ok: true, review });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to review resume." });
  }
});

router.post("/generate-resume", async (req, res) => {
  const auth = await requireAuthAndRateLimit(req, res, "ai-generate-resume");
  if (!auth) return;

  try {
    const body = req.body as { job?: Partial<JobRecord> & Record<string, unknown>; profile?: unknown };

    if (!body.job) {
      return res.status(400).json({ error: "A job payload is required." });
    }

    const profile = sanitizeProfileData(body.profile);
    if (!profile) {
      return res.status(400).json({ error: "A profile payload is required." });
    }

    const { model: _model, resume } = await generateAtsResumeWithAi(profile, body.job);
    res.json({ ok: true, resume });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to generate a tailored resume." });
  }
});

router.post("/learning-plan", async (req, res) => {
  const auth = await requireAuthAndRateLimit(req, res, "ai-learning-plan");
  if (!auth) return;

  try {
    const body = req.body as { tracks?: LearningPlanTrackInput[]; weakRows?: LearningPlanWeakRowInput[] };

    if (!Array.isArray(body.tracks) || body.tracks.length === 0) {
      return res.status(400).json({ error: "Curriculum data is required." });
    }

    const { model: _model, ...plan } = await generateLearningPlanWithAi(body.tracks, body.weakRows ?? []);
    res.json({ ok: true, plan });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to generate a learning plan." });
  }
});

export default router;
