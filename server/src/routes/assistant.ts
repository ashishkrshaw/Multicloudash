import { Router } from "express";
import { buildAssistantSnapshot } from "../services/assistant/context.js";
import { generateAssistantResponse, type AssistantMessage } from "../services/assistant/perplexity.js";
import { authenticateUser, optionalAuth } from "../middleware/auth.js";
import { addChatMessage, getChatHistory, clearChatHistory } from "../utils/chatHistory.js";

const assistantRouter = Router();

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

assistantRouter.post("/chat", optionalAuth, async (req, res, next) => {
  try {
    // Check if AI_API_KEY is configured
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey || apiKey === '' || apiKey === 'pplx-your-api-key-here') {
      return res.status(503).json({ 
        error: "AI Assistant is not configured. Please set AI_API_KEY in your environment variables. Get your API key from https://www.perplexity.ai/settings/api" 
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

    const snapshot = await buildAssistantSnapshot();
    
    let completion;
    try {
      completion = await generateAssistantResponse(trimmedMessages, snapshot);
    } catch (aiError) {
      // Handle AI API errors gracefully
      const errorMessage = aiError instanceof Error ? aiError.message : "AI service unavailable";
      console.error('[Assistant] AI generation failed:', errorMessage);
      return res.status(503).json({ 
        error: `Unable to generate response: ${errorMessage}. Please check AI_API_KEY configuration.` 
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

    res.json({
      reply: completion.reply,
      model: completion.model,
      usage: completion.usage,
      snapshotGeneratedAt: snapshot.generatedAt,
    });
  } catch (error) {
    // Ensure we always return JSON even for unexpected errors
    console.error('[Assistant] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: errorMessage });
  }
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
    
    res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    next(error);
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
    
    res.json({
      success: true,
      message: "Chat history cleared",
    });
  } catch (error) {
    next(error);
  }
});

export default assistantRouter;
