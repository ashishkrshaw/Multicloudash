import { Router } from "express";
import { getGcpOverview } from "../services/gcp/overview.js";

const gcpRouter = Router();

gcpRouter.get("/overview", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const overview = await getGcpOverview(userId);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

export default gcpRouter;
