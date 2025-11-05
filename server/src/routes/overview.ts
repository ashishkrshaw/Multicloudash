import { Router } from "express";
import { getUnifiedOverview } from "../services/overview.js";

const overviewRouter = Router();

overviewRouter.get("/", async (_req, res) => {
  try {
    console.log('[Overview] Fetching unified overview');
    const overview = await getUnifiedOverview();
    console.log('[Overview] Success');
    return res.json(overview);
  } catch (error) {
    console.error('[Overview] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch overview';
    return res.status(500).json({ 
      error: errorMessage,
      costTotals: { combined: { total: 0, currency: 'USD' } },
      computeTotals: { combined: { total: 0, running: 0, stopped: 0 } },
      usageBreakdown: [],
      insights: [],
      notes: [],
      costTimeline: []
    });
  }
});

export default overviewRouter;
