import { useMemo, useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatPayload = {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
};

type ChatResponse = {
  reply: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  snapshotGeneratedAt: string;
};

const createMessageId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const starterMessage: ConversationMessage = {
  id: createMessageId(),
  role: "assistant",
  content:
    "Hey! 👋 Got your cloud data ready. What's up - costs, idle stuff, or just browsing?",
};

export const AssistantPanel = ({ open, onOpenChange }: AssistantPanelProps) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([starterMessage]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const historyPayload = useMemo(
    () => {
      // Filter out the starter message and ensure we only send user/assistant pairs
      // Perplexity requires alternating user/assistant messages after system message
      const filtered = messages
        .filter((msg) => msg.id !== starterMessage.id)
        .map(({ role, content }) => ({ role, content })) as ChatPayload["messages"];
      
      return filtered;
    },
    [messages],
  );

  const mutation = useMutation<ChatResponse, Error, ChatPayload>({
    mutationFn: async (payload) => {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body.error === "string" ? body.error : response.statusText;
        throw new Error(message || "Assistant request failed");
      }

      return (await response.json()) as ChatResponse;
    },
  });

  const handleSubmit = async () => {
    const question = input.trim();
  if (!question || mutation.isPending) {
      return;
    }
    setError(null);
    setInput("");

    const userMessage: ConversationMessage = {
      id: createMessageId(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const payload: ChatPayload = {
        messages: [...historyPayload, { role: "user" as const, content: question }].slice(-10),
      };
      const result = await mutation.mutateAsync(payload);
      const assistantMessage: ConversationMessage = {
        id: createMessageId(),
        role: "assistant",
        content: result.reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error calling assistant");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const resetConversation = () => {
    setMessages([starterMessage]);
    setError(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-border/60 bg-card/50 px-4 py-4 text-left shadow-sm sm:px-6 sm:py-5">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary sm:h-8 sm:w-8">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            CloudCTRL Copilot
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Context-aware assistant powered by live cloud telemetry.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <div className="space-y-3 pb-4 sm:space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex w-full">
                  <div
                    className={
                      message.role === "assistant"
                        ? "ml-0 max-w-[90%] rounded-2xl rounded-bl-none bg-muted/60 p-3 text-sm leading-relaxed text-foreground shadow sm:max-w-[85%] sm:p-4"
                        : "ml-auto max-w-[90%] rounded-2xl rounded-br-none bg-primary p-3 text-sm leading-relaxed text-primary-foreground shadow sm:max-w-[85%] sm:p-4"
                    }
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {mutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Drafting response…
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-border/60 bg-card/80 px-4 py-3 sm:px-6 sm:py-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="hidden sm:inline">Responses stay within your dashboard context.</span>
              <span className="inline sm:hidden">Context-aware responses</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs sm:h-7" onClick={resetConversation}>
                Reset
              </Button>
            </div>
            <div className="flex items-end gap-2 sm:gap-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about costs, resources, or optimizations..."
                rows={3}
                className="max-h-32 min-h-[70px] resize-none border-border/70 bg-background/80 text-sm shadow-inner sm:min-h-[90px]"
              />
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || mutation.isPending}
                className="h-[46px] shrink-0 rounded-xl px-3 sm:px-4"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {mutation.data?.usage && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="border-border/60 bg-transparent text-[10px] sm:text-xs">
                  {mutation.data.model}
                </Badge>
                <span className="text-[10px] sm:text-xs">
                  {mutation.data.usage.totalTokens ?? "—"} tokens
                </span>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
