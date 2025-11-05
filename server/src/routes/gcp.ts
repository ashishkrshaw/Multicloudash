import { Router } from "express";
import { getGcpOverview } from "../services/gcp/overview.js";

const gcpRouter = Router();

gcpRouter.get("/overview", async (req, res) => {
  try {
    const userId = (req as any).userId;
    console.log('[GCP] Fetching overview', userId ? `for user ${userId}` : '(no auth)');
    const overview = await getGcpOverview(userId);
    console.log('[GCP] Success');
    return res.json(overview);
  } catch (error) {
    console.error('[GCP] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch GCP overview';
    return res.status(500).json({ 
      error: errorMessage,
      projectId: null,
      cost: { total: 0, currency: 'USD', byService: [], changePercentage: null },
      compute: null,
      sql: null,
      insights: [],
      alerts: [],
      errors: [{ section: 'overview', message: errorMessage }]
    });
  }
});

export default gcpRouter;
