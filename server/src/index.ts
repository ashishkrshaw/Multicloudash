import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import awsRouter from "./routes/aws.js";
import azureRouter from "./routes/azure.js";
import gcpRouter from "./routes/gcp.js";
import overviewRouter from "./routes/overview.js";
import assistantRouter from "./routes/assistant.js";
import credentialsRouter from "./routes/credentials.js";
import testRouter from "./routes/test.js";
import authRouter from "./routes/auth.js";
import { corsOptions, securityHeaders, generalLimiter } from "./middleware/security.js";
import { optionalAuth } from "./middleware/auth.js";

const app = express();

// Trust proxy - CRITICAL for Render deployment
// This allows Express to properly handle X-Forwarded-For headers from the Render proxy
app.set('trust proxy', 1);

// Log startup mode
const mode = process.env.NODE_ENV || 'development';
console.log(`🚀 Starting CloudCTRL API in ${mode.toUpperCase()} mode`);

// Security middleware (must be first)
app.use(corsOptions);
app.use(securityHeaders);

// Body parsing
app.use(express.json());

// Rate limiting
app.use(generalLimiter);

// Optional auth for all routes (attaches user if token present)
app.use(optionalAuth);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/aws", awsRouter);
app.use("/api/azure", azureRouter);
app.use("/api/gcp", gcpRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/test", testRouter);
app.use("/auth", authRouter); // Google OAuth callback route

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      details: err.errors.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status?: number }).status) : 500;
  const message =
    typeof err === "object" && err !== null && "message" in err ? String((err as { message?: string }).message) : "Unknown error";

  console.error("Unhandled error", err);

  return res.status(Number.isFinite(status) ? status : 500).json({
    error: message,
  });
});

const port = Number.parseInt(process.env.PORT || "4000", 10);

app.listen(port, () => {
  console.log(`CloudCTRL API listening on http://localhost:${port}`);
});
