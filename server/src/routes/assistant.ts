import { Router } from "express";
import { generateAssistantResponse, type AssistantMessage, type SimpleSnapshot } from "../services/assistant/perplexity.js";
import { authenticateUser, optionalAuth } from "../middleware/auth.js";
import { addChatMessage, getChatHistory, clearChatHistory } from "../utils/chatHistory.js";

const assistantRouter = Router();

// Simple context for AI - lightweight and fast
const buildSimpleSnapshot = (): SimpleSnapshot => {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    contextSummary: `Development Mode - Limited telemetry available.
    
CloudCTRL Dashboard Status:
- Environment: Development
- Backend API: Running
- Authentication: Active
- Cloud Providers: AWS, Azure, GCP support enabled

Available Features:
- Cloud cost analysis and recommendations
- Resource optimization suggestions
- Security best practices guidance
- Multi-cloud management advice
- FinOps consulting

Note: In development mode, I provide general cloud management guidance. For specific cost and resource data, please configure cloud credentials in the production environment.`,
  };
};

const isAssistantMessageArray = (input: unknown): input is AssistantMessage[] => {
  if (!Array.isArray(input)) {
    return false;
  }
  return input.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as AssistantMessage).content === "string" &&
      ["user", "assistant", "system"].includes((item as AssistantMessage).role),
  );
};

const validateMessageAlternation = (messages: AssistantMessage[]): boolean => {
  // After filtering out system messages, ensure user/assistant alternate
  const nonSystemMessages = messages.filter((msg) => msg.role !== "system");
  
  if (nonSystemMessages.length === 0) {
    return true; // Empty is valid
  }
  
  // First non-system message should be user
  if (nonSystemMessages[0].role !== "user") {
    return false;
  }
  
  // Check alternation
  for (let i = 1; i < nonSystemMessages.length; i++) {
    const prev = nonSystemMessages[i - 1];
    const curr = nonSystemMessages[i];
    
    // Must alternate between user and assistant
    if (prev.role === curr.role) {
      return false;
    }
    if (prev.role === "user" && curr.role !== "assistant") {
      return false;
    }
    if (prev.role === "assistant" && curr.role !== "user") {
      return false;
    }
  }
  
  return true;
};

assistantRouter.post("/chat", optionalAuth, async (req, res) => {
  // Set JSON content type immediately
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // Check if AI_API_KEY is configured
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey || apiKey === '' || apiKey === 'pplx-your-api-key-here') {
      console.log('[Assistant] AI_API_KEY not configured');
      return res.status(503).json({ 
        error: "AI Assistant is not configured. Please add AI_API_KEY environment variable in Render dashboard. Get your key from https://www.perplexity.ai/settings/api" 
      });
    }

    const messages = req.body?.messages;
    if (!isAssistantMessageArray(messages)) {
      return res.status(400).json({ error: "messages must be an array of { role, content }" });
    }
    
    if (!validateMessageAlternation(messages)) {
      return res.status(400).json({ 
        error: "messages must alternate between user and assistant roles (after any system messages)" 
      });
    }

    const trimmedMessages = messages.map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    }));

    // Use simple snapshot for development - faster and doesn't hammer database
    const snapshot = buildSimpleSnapshot();
    
    console.log('[Assistant] Processing chat request with', trimmedMessages.length, 'messages');
    
    let completion;
    try {
      completion = await generateAssistantResponse(trimmedMessages, snapshot);
      console.log('[Assistant] Successfully generated response');
    } catch (aiError) {
      // Handle AI API errors gracefully with fallback response
      const errorMessage = aiError instanceof Error ? aiError.message : "AI service unavailable";
      console.error('[Assistant] AI generation failed:', errorMessage);
      
      // Return a fallback response instead of error (better UX)
      const lastUserMessage = trimmedMessages.filter(m => m.role === 'user').pop();
      const fallbackReply = `I'm currently experiencing technical difficulties connecting to the AI service. ${
        errorMessage.includes('API key') 
          ? 'Please ensure the AI_API_KEY is configured in your environment variables.' 
          : 'Please try again in a moment.'
      }

Meanwhile, I'm here to help with:
• Cloud cost optimization strategies
• AWS, Azure, and GCP best practices
• Resource management advice
• Security recommendations

Your question: "${lastUserMessage?.content.substring(0, 100)}..."`;

      return res.status(200).json({
        reply: fallbackReply,
        model: 'fallback',
        usage: { totalTokens: 0 },
        snapshotGeneratedAt: snapshot.generatedAt,
        mode: 'fallback',
        warning: 'AI service unavailable - showing fallback response'
      });
    }

    // Store chat history if user is authenticated
    if (req.userId) {
      try {
        // Store user message
        const userMessage = trimmedMessages.find(m => m.role === 'user');
        if (userMessage) {
          await addChatMessage(req.userId, 'user', userMessage.content);
        }
        
        // Store assistant reply
        await addChatMessage(req.userId, 'assistant', completion.reply);
      } catch (chatError) {
        // Log error but don't fail the request
        console.error('[Assistant] Failed to save chat history:', chatError);
      }
    }

    return res.status(200).json({
      reply: completion.reply,
      model: completion.model,
      usage: completion.usage,
      snapshotGeneratedAt: snapshot.generatedAt,
      mode: 'development',
    });
  } catch (error) {
    // Ensure we always return JSON even for unexpected errors
    console.error('[Assistant] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: errorMessage });
  }
});

/**
 * GET /api/assistant/health
 * Health check for assistant service
 */
assistantRouter.get("/health", async (req, res) => {
  const apiKey = process.env.AI_API_KEY;
  const apiConfigured = apiKey && apiKey !== '' && apiKey !== 'pplx-your-api-key-here';
  
  return res.json({
    status: 'ok',
    service: 'assistant',
    aiConfigured: apiConfigured,
    endpoints: ['/chat', '/history'],
    mode: 'development'
  });
});

/**
 * GET /api/assistant/history
 * Get user's chat history
 */
assistantRouter.get("/history", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    const history = await getChatHistory(userId, limit);
    
    return res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('[Assistant] Get history error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve chat history',
      success: false 
    });
  }
});

/**
 * DELETE /api/assistant/history
 * Clear user's chat history
 */
assistantRouter.delete("/history", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.userId!;
    
    await clearChatHistory(userId);
    
    return res.json({
      success: true,
      message: "Chat history cleared",
    });
  } catch (error) {
    console.error('[Assistant] Clear history error:', error);
    return res.status(500).json({ 
      error: 'Failed to clear chat history',
      success: false 
    });
  }
});

export default assistantRouter;
