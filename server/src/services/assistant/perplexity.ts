import type { AssistantSnapshot } from "./context.js";

export type AssistantRole = "user" | "assistant" | "system";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantCompletion {
  reply: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

const API_URL = process.env.AI_API_URL ?? "https://api.perplexity.ai/chat/completions";
const FALLBACK_MODELS = ["sonar-pro"] as const;
const DEFAULT_PAYLOAD = {
  temperature: 0.7, // More creative and conversational
  max_tokens: 400, // Shorter, more focused responses
} as const;

class InvalidModelError extends Error {
  constructor(public readonly model: string, message: string) {
    super(message);
    this.name = "InvalidModelError";
  }
}

const formatCurrency = (value: number, currency = "USD", maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits }).format(
    Number.isFinite(value) ? value : 0,
  );

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";

const cleanCitations = (text: string): string => {
  // Remove citation markers like [1], [2], [5], etc.
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/\[(\d+)\]\[(\d+)\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const summariseOverviewBlock = (snapshot: AssistantSnapshot): string => {
  if (!snapshot.overview) {
    return `Snapshot generated at ${snapshot.generatedAt}. Multi-cloud overview unavailable.`;
  }

  const { overview } = snapshot;
  const combined = overview.costTotals.combined;

  const costLines = Object.entries(overview.costTotals)
    .filter(([provider]) => provider !== "combined")
    .map(([provider, totals]) =>
      totals
        ? `${provider.toUpperCase()}: ${formatCurrency(totals.total, totals.currency)} (Δ ${formatPercent(totals.changePercentage)})`
        : `${provider.toUpperCase()}: unavailable`,
    );

  const computeLines = Object.entries(overview.computeTotals)
    .filter(([provider]) => provider !== "combined")
    .map(([provider, totals]) =>
      totals ? `${provider.toUpperCase()}: ${totals.running}/${totals.total} running (${totals.stopped} idle)` : `${provider.toUpperCase()}: unavailable`,
    );

  const topUsage = overview.usageBreakdown
    .slice(0, 8)
    .map((item) => {
      const currency = overview.costTotals[item.provider]?.currency ?? "USD";
      return `${item.provider.toUpperCase()} • ${item.service}: ${formatCurrency(item.amount, currency, 2)}`;
    });

  const insightLines = overview.insights.map(
    (insight) => `${insight.provider.toUpperCase()} [${insight.severity}]: ${insight.title} — ${insight.detail}`,
  );
  const noteLines = overview.notes.map((note) => `${note.provider.toUpperCase()}: ${note.message}`);

  return [
    `Snapshot generated at ${snapshot.generatedAt}. Combined spend ${formatCurrency(combined.total, combined.currency)}.`,
    costLines.length ? `Provider spend:
- ${costLines.join("\n- ")}` : "Provider spend: unavailable",
    computeLines.length ? `Compute footprint:
- ${computeLines.join("\n- ")}` : "Compute footprint: unavailable",
    topUsage.length ? `Top services by spend:
- ${topUsage.join("\n- ")}` : "No usage breakdown available",
    insightLines.length ? `Active insights:
- ${insightLines.join("\n- ")}` : "No active insights reported",
    noteLines.length ? `Provider notes:
- ${noteLines.join("\n- ")}` : "No provider warnings",
  ].join("\n\n");
};

const summariseAwsBlock = (snapshot: AssistantSnapshot): string | null => {
  const { costSummary, ec2, s3 } = snapshot.aws;
  if (!costSummary && !ec2 && !s3) {
    return null;
  }

  const lines: string[] = [];

  if (costSummary) {
    const currency = costSummary.total.currency;
    const topServices = costSummary.topServices.slice(0, 6).map(
      (service) => `${service.service}: ${formatCurrency(service.amount, currency, 2)}`,
    );
    lines.push(
      `Spend (last ${costSummary.timeSeries.length} days): ${formatCurrency(costSummary.total.amount, currency, 0)}`,
    );
    if (topServices.length) {
      lines.push(`Top services: ${topServices.join("; ")}`);
    }
  } else {
    lines.push("Spend data unavailable");
  }

  if (ec2) {
    const totals = ec2.reduce(
      (acc, instance) => {
        acc.total += 1;
        switch (instance.state) {
          case "running":
            acc.running += 1;
            if (acc.hotspots.length < 5) {
              acc.hotspots.push(`${instance.name} (${instance.type}, ${instance.region})`);
            }
            break;
          case "stopped":
          case "stopping":
            acc.stopped += 1;
            break;
          case "terminated":
            acc.terminated += 1;
            break;
          default:
            break;
        }
        return acc;
      },
      { total: 0, running: 0, stopped: 0, terminated: 0, hotspots: [] as string[] },
    );
    lines.push(
      `EC2 fleet: ${totals.running}/${totals.total} running · ${totals.stopped} stopped · ${totals.terminated} terminated`,
    );
    if (totals.hotspots.length) {
      lines.push(`High-visibility instances: ${totals.hotspots.join("; ")}`);
    }
  }

  if (s3) {
    lines.push(`S3 buckets discovered: ${s3.length}`);
  }

  return `AWS overview:
- ${lines.join("\n- ")}`;
};

const summariseAzureBlock = (azure: AssistantSnapshot["azure"]): string | null => {
  if (!azure) {
    return null;
  }

  const lines: string[] = [];

  const monthWindow = azure.cost?.find((window) => window.label.toLowerCase().includes("month")) ?? azure.cost?.[0];
  if (monthWindow) {
    lines.push(
      `Spend (${monthWindow.label}): ${formatCurrency(monthWindow.total.amount, monthWindow.total.currency, 0)}`,
    );
    const topServices = monthWindow.byService.slice(0, 5).map(
      (service) => `${service.service}: ${formatCurrency(service.amount, monthWindow.total.currency, 2)}`,
    );
    if (topServices.length) {
      lines.push(`Top services: ${topServices.join("; ")}`);
    }
  } else {
    lines.push("Spend data unavailable");
  }

  if (azure.compute?.totals) {
    const totals = azure.compute.totals;
    lines.push(
      `Virtual machines: ${totals.running ?? 0}/${totals.total ?? 0} running · ${(totals.stopped ?? 0) + (totals.deallocated ?? 0)} idle`,
    );
  }

  if (azure.storage?.accounts?.length) {
    lines.push(`Storage accounts: ${azure.storage.accounts.length}`);
  }

  if (azure.errors.length) {
    lines.push(`Issues: ${azure.errors.map((error) => `${error.section} → ${error.message}`).join("; ")}`);
  }

  return `Azure overview:
- ${lines.join("\n- ")}`;
};

const summariseGcpBlock = (gcp: AssistantSnapshot["gcp"]): string | null => {
  if (!gcp) {
    return null;
  }

  const lines: string[] = [];

  const cost = gcp.cost;
  lines.push(`Spend (current month): ${formatCurrency(cost.total, cost.currency, 0)} (Δ ${formatPercent(cost.changePercentage)})`);
  const topServices = cost.byService.slice(0, 5).map(
    (entry) => `${entry.service}: ${formatCurrency(entry.amount, cost.currency, 2)}`,
  );
  if (topServices.length) {
    lines.push(`Top services: ${topServices.join("; ")}`);
  }

  const computeTotals = gcp.compute?.totals;
  if (computeTotals) {
    lines.push(
      `Compute Engine: ${computeTotals.running}/${computeTotals.total} running · ${computeTotals.stopped} stopped · ${computeTotals.terminated} terminated`,
    );
  }

  const sqlTotals = gcp.sql?.totals;
  if (sqlTotals) {
    lines.push(`Cloud SQL: ${sqlTotals.running}/${sqlTotals.total} runnable`);
  }

  if (gcp.alerts.length) {
    lines.push(`Alerts: ${gcp.alerts.map((alert) => `${alert.severity} → ${alert.message}`).join("; ")}`);
  }

  if (gcp.errors.length) {
    lines.push(`Issues: ${gcp.errors.map((error) => `${error.section} → ${error.message}`).join("; ")}`);
  }

  return `GCP overview (${gcp.projectId ?? "unknown project"}):
- ${lines.join("\n- ")}`;
};

const summariseSnapshot = (snapshot: AssistantSnapshot): string => {
  const blocks: Array<string | null> = [
    summariseOverviewBlock(snapshot),
    summariseAwsBlock(snapshot),
    summariseAzureBlock(snapshot.azure),
    summariseGcpBlock(snapshot.gcp),
    snapshot.errors.length
      ? `Data collection warnings:
- ${snapshot.errors.join("\n- ")}`
      : null,
  ];

  return blocks.filter((block): block is string => Boolean(block)).join("\n\n");
};

export const generateAssistantResponse = async (
  messages: AssistantMessage[],
  snapshot: AssistantSnapshot,
): Promise<AssistantCompletion> => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured");
  }

  const systemPrompt = `You are CloudCTRL Copilot, a sharp cloud FinOps expert. Keep it brief and punchy.

**Your style:**
- Super concise - 2-3 sentences max for most answers
- For greetings (hi/hello/hey): ONE sentence + quick redirect
- Witty when appropriate, always professional
- Use plain English, skip the corporate speak
- Get to the point fast

**For greetings, respond like:**
"Hey! Got your cloud data loaded. What do you want to check - costs, idle resources, or savings opportunities?"

**For technical questions:**
- Lead with the answer/insight
- One supporting detail
- One action item

**Critical rules:**
- NO citation markers [1][2][5]
- ONLY use provided telemetry data
- Never invent numbers
- Keep it tight - brevity is your superpower

**Example responses:**
❌ "Based on comprehensive analysis of your infrastructure utilization metrics..."
✅ "5 EC2 instances at 5% CPU. Downsize to t3.medium → save $200/mo."

❌ "I've reviewed your spending patterns and identified several areas..."
✅ "AWS jumped 47% this month. Main culprit: S3 storage doubled to 8TB."

Remember: Short, sharp, helpful. No fluff.`;
  const contextBlock = summariseSnapshot(snapshot);

  const explicitModel = process.env.AI_MODEL?.trim();
  const candidateModels = Array.from(
    new Set([explicitModel, ...FALLBACK_MODELS].filter((model): model is string => Boolean(model))),
  );

  const invalidModelMessages: string[] = [];

  const callPerplexity = async (model: string): Promise<AssistantCompletion> => {
    // Check if the user is asking about their specific infrastructure
    const userMessages = messages.filter((msg) => msg.role === "user");
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
    const isInfrastructureQuery = lastUserMessage?.content.toLowerCase().match(
      /\b(cost|spend|resource|instance|bucket|vm|database|storage|compute|bill|usage|optimize|rightsiz|alert|warning|error)\b/i
    );

    const payload = {
      model,
      temperature: DEFAULT_PAYLOAD.temperature,
      max_tokens: DEFAULT_PAYLOAD.max_tokens,
      // Disable web search for infrastructure queries (use only our context)
      // Enable it for general questions
      disable_search: Boolean(isInfrastructureQuery),
      // Don't include citations in responses
      return_citations: false,
      messages: [
        { role: "system" as const, content: `${systemPrompt}\n\nCurrent telemetry:\n${contextBlock}` },
        ...messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = errorText;
      try {
        const parsed = JSON.parse(errorText) as { error?: { message?: string; type?: string } };
        if (parsed?.error) {
          const message = parsed.error.message ?? parsed.error.type ?? "";
          if (parsed.error.type === "invalid_model") {
            detail = message || "Invalid model";
            throw new InvalidModelError(model, detail.trim());
          }
          if (message) {
            detail = message;
          }
        }
      } catch (error) {
        if (error instanceof InvalidModelError) {
          throw error;
        }
        // ignore JSON parse errors and fall back to raw text detail
      }
      throw new Error(`Perplexity API request failed with status ${response.status}: ${detail}`);
    }

    const data = (await response.json()) as {
      id?: string;
      model?: string;
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = data.choices?.[0];
    const reply = choice?.message?.content ?? choice?.text;

    if (!reply) {
      throw new Error("Perplexity API returned no response content.");
    }

    // Clean up the response - remove citation markers and extra whitespace
    const cleanedReply = cleanCitations(reply);

    return {
      reply: cleanedReply.trim(),
      model: data.model ?? model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  };

  for (const model of candidateModels) {
    try {
      return await callPerplexity(model);
    } catch (error) {
      if (error instanceof InvalidModelError) {
        invalidModelMessages.push(`'${error.model}' (${error.message})`);
        continue;
      }
      throw error;
    }
  }

  const modelHint = explicitModel ? `AI_MODEL='${explicitModel}'` : `Tried defaults: ${candidateModels.join(", ")}`;
  const detail = invalidModelMessages.length ? invalidModelMessages.join("; ") : "no supported models returned a response";
  throw new Error(`Perplexity rejected all candidate models (${modelHint}). Details: ${detail}`);
};
