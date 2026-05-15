import { Router, type IRouter } from "express";
import { submitVideoJob, getVideoStatus } from "../lib/heygen";

const router: IRouter = Router();

/* ── Submit a new video generation job ───────────────────── */
router.post("/heygen/generate", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  try {
    const videoId = await submitVideoJob(text.trim());
    res.json({ videoId });
  } catch (err) {
    console.error("HeyGen generate error:", err);
    res.status(500).json({ error: "Failed to submit video job" });
  }
});

/* ── Poll the status of a video generation job ───────────── */
router.get("/heygen/status/:videoId", async (req, res) => {
  const { videoId } = req.params;
  try {
    const result = await getVideoStatus(videoId);
    res.json(result);
  } catch (err) {
    console.error("HeyGen status error:", err);
    res.status(500).json({ error: "Failed to get video status" });
  }
});

export default router;
