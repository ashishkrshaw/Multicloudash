import { Router } from "express";
import { z } from "zod";
import { getCostSummary } from "../services/costExplorer.js";
import { getBillingOverview } from "../services/billing.js";
import { listApiGateways } from "../services/apigateway.js";
import { listCloudFrontDistributions } from "../services/cloudfront.js";
import { listCloudWatchAlarms } from "../services/cloudwatch.js";
import { listTrails } from "../services/cloudtrail.js";
import { listDynamoTables } from "../services/dynamodb.js";
import { listEc2Instances, startEc2Instance, stopEc2Instance } from "../services/ec2.js";
import { listLambdaFunctions } from "../services/lambda.js";
import { listRdsInstances } from "../services/rds.js";
import { listRoute53HostedZones } from "../services/route53.js";
import { listS3Buckets } from "../services/s3.js";
import { listVpcs } from "../services/vpc.js";
import { optionalAuth } from "../middleware/auth.js";
import { getCachedData, setCachedData, invalidateCache } from "../utils/cache.js";

const querySchema = z.object({
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  granularity: z.enum(["DAILY", "MONTHLY"]).default("MONTHLY"),
});

const awsRouter = Router();

// Apply optional auth to all routes
awsRouter.use(optionalAuth);

const instanceIdSchema = z.object({
  instanceId: z.string().min(1, "Instance ID is required"),
});

const instanceRegionSchema = z.object({
  region: z.string().min(1, "Region is required").optional(),
});

awsRouter.get("/cost/summary", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const forceRefresh = req.query.refresh === 'true';
    
    const parsed = querySchema.parse({
      start: typeof req.query.start === "string" ? req.query.start : undefined,
      end: typeof req.query.end === "string" ? req.query.end : undefined,
      granularity: typeof req.query.granularity === "string" ? req.query.granularity.toUpperCase() : undefined,
    });

    const cacheKey = `cost-summary-${parsed.granularity}`;
    
    if (!forceRefresh) {
      const cached = await getCachedData(userId, 'aws', cacheKey);
      if (cached) {
        return res.json({ ...cached, fromCache: true });
      }
    }

    const summary = await getCostSummary(parsed, userId);
    await setCachedData(userId, 'aws', cacheKey, summary);
    
    res.json({ ...summary, fromCache: false });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/billing/overview", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const overview = await getBillingOverview(userId);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/ec2/instances", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const forceRefresh = req.query.refresh === 'true';

    // Check cache first
    if (!forceRefresh) {
      const cached = await getCachedData(userId, 'aws', 'ec2-instances');
      if (cached) {
        return res.json({ instances: cached, fromCache: true });
      }
    }

    // Fetch fresh data with userId
    const instances = await listEc2Instances(userId);
    
    // Cache for 24 hours
    await setCachedData(userId, 'aws', 'ec2-instances', instances);
    
    res.json({ instances, fromCache: false });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/s3/buckets", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh) {
      const cached = await getCachedData(userId, 'aws', 's3-buckets');
      if (cached) {
        return res.json({ buckets: cached, fromCache: true });
      }
    }

    const buckets = await listS3Buckets(userId);
    await setCachedData(userId, 'aws', 's3-buckets', buckets);
    
    res.json({ buckets, fromCache: false });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/route53/hosted-zones", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const zones = await listRoute53HostedZones(userId);
    res.json({ zones });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/apigateway/rest-apis", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const apis = await listApiGateways(userId);
    res.json({ apis });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/vpcs", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const vpcs = await listVpcs(userId);
    res.json({ vpcs });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/cloudfront/distributions", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const distributions = await listCloudFrontDistributions(userId);
    res.json({ distributions });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/cloudwatch/alarms", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const alarms = await listCloudWatchAlarms(userId);
    res.json({ alarms });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/cloudtrail/trails", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const trails = await listTrails(userId);
    res.json({ trails });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/lambda/functions", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const functions = await listLambdaFunctions(userId);
    res.json({ functions });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/dynamodb/tables", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const tables = await listDynamoTables(userId);
    res.json({ tables });
  } catch (error) {
    next(error);
  }
});

awsRouter.get("/rds/instances", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    const instances = await listRdsInstances(userId);
    res.json({ instances });
  } catch (error) {
    next(error);
  }
});

awsRouter.post("/ec2/instances/:instanceId/start", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { instanceId } = instanceIdSchema.parse(req.params);
    const { region } = instanceRegionSchema.parse(req.body ?? {});
    const summary = await startEc2Instance(instanceId, region, userId);
    if (!summary) {
      return res.status(404).json({ error: `Instance ${instanceId} not found` });
    }
    
    // Invalidate cache after instance start
    if (userId) {
      await invalidateCache(userId, 'aws', 'ec2-instances');
    }
    
    return res.json({ instance: summary });
  } catch (error) {
    next(error);
  }
});

awsRouter.post("/ec2/instances/:instanceId/stop", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { instanceId } = instanceIdSchema.parse(req.params);
    const { region } = instanceRegionSchema.parse(req.body ?? {});
    const summary = await stopEc2Instance(instanceId, region, userId);
    if (!summary) {
      return res.status(404).json({ error: `Instance ${instanceId} not found` });
    }
    
    // Invalidate cache after instance stop
    if (userId) {
      await invalidateCache(userId, 'aws', 'ec2-instances');
    }
    
    return res.json({ instance: summary });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/aws/cache/refresh
 * Force refresh all AWS data cache
 */
awsRouter.post("/cache/refresh", async (req, res, next) => {
  try {
    const userId = req.userId || 'anonymous';
    
    // Invalidate all AWS cache for this user
    await invalidateCache(userId, 'aws');
    
    res.json({
      success: true,
      message: 'AWS cache refreshed successfully',
      provider: 'aws',
    });
  } catch (error) {
    next(error);
  }
});

export default awsRouter;
