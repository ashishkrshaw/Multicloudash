import { Router } from "express";
import { getUnifiedOverview } from "../services/overview.js";

const overviewRouter = Router();

overviewRouter.get("/", async (_req, res, next) => {
  try {
    const overview = await getUnifiedOverview();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

export default overviewRouter;
