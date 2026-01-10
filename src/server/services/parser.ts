import type { NewSession, NewToolCall, NewMessage } from "../db/schema.ts";

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
  thinking?: string;
}

interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface SessionMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  type: "user" | "assistant" | "summary" | "file-history-snapshot";
  isSidechain?: boolean;
  agentId?: string;
  message: {
    role: "user" | "assistant";
    model?: string;
    id?: string;
    content: ContentBlock[] | string;
    usage?: UsageInfo;
  };
  toolUseResult?: {
    durationMs: number;
    stdout?: string;
    stderr?: string;
    result?: string;
    bytes?: number;
    code?: number;
    url?: string;
  };
  sourceToolAssistantUUID?: string;
}

interface ParseResult {
  session: NewSession | null;
  toolCalls: NewToolCall[];
  messages: NewMessage[];
}

export async function parseJSONL(content: string): Promise<ParseResult> {
  const lines = content.trim().split("\n").filter(Boolean);
  const parsedMessages: SessionMessage[] = [];

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as SessionMessage;
      parsedMessages.push(msg);
    } catch {
      // Skip invalid JSON lines
      continue;
    }
  }

  if (parsedMessages.length === 0) {
    return { session: null, toolCalls: [], messages: [] };
  }

  // Find first message with valid session data (skip file-history-snapshot etc)
  const validMessages = parsedMessages.filter(
    (m) => m.timestamp && m.sessionId && (m.type === "user" || m.type === "assistant")
  );

  if (validMessages.length === 0) {
    return { session: null, toolCalls: [], messages: [] };
  }

  // Extract session info from first valid message
  const firstMsg = validMessages[0]!;
  const lastMsg = validMessages[validMessages.length - 1]!;

  // Calculate totals
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  const toolCallsData: NewToolCall[] = [];
  const messagesData: NewMessage[] = [];
  const subAgents = new Set<string>();

  // Track tool uses to match with results
  const toolUseMap = new Map<string, { name: string; input: Record<string, unknown>; startTime: number }>();
  const sessionStartTime = new Date(firstMsg.timestamp).getTime();

  for (const msg of validMessages) {
    // Track sub-agents
    if (msg.agentId) {
      subAgents.add(msg.agentId);
    }

    // Accumulate token usage
    if (msg.message?.usage) {
      inputTokens += msg.message.usage.input_tokens || 0;
      outputTokens += msg.message.usage.output_tokens || 0;
      cacheReadTokens += msg.message.usage.cache_read_input_tokens || 0;
      cacheCreationTokens += msg.message.usage.cache_creation_input_tokens || 0;
    }

    // Add message (only if it has actual user text content)
    if (msg.type === "user" || msg.type === "assistant") {
      let content = "";
      let isToolResultOnly = false;

      let thinking = "";

      if (Array.isArray(msg.message?.content)) {
        // Check if content is only tool_result (not a real user prompt)
        const hasTextContent = msg.message.content.some((b) => b.type === "text");
        const hasThinkingContent = msg.message.content.some((b) => b.type === "thinking");
        const hasOnlyToolResult = msg.message.content.every(
          (b) => b.type === "tool_result" || b.type === "tool_use"
        );

        if (hasOnlyToolResult && !hasTextContent && !hasThinkingContent) {
          isToolResultOnly = true;
        } else {
          // Extract text content
          content = msg.message.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { type: "text"; text?: string }).text || "")
            .join("\n");

          // Extract thinking content
          thinking = msg.message.content
            .filter((b) => b.type === "thinking")
            .map((b) => (b as { type: "thinking"; thinking?: string }).thinking || "")
            .join("\n");
        }
      } else {
        content = String(msg.message?.content || "");
      }

      // Skip tool_result-only messages - they're not real user prompts
      if (!isToolResultOnly) {
        messagesData.push({
          id: crypto.randomUUID(),
          sessionId: msg.sessionId,
          uuid: msg.uuid,
          parentUuid: msg.parentUuid,
          type: msg.type,
          agentId: msg.agentId,
          isSidechain: msg.isSidechain || false,
          content,
          thinking,
          timestamp: msg.timestamp,
        });
      }
    }

    // Process content blocks for tool calls
    if (Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        // Track tool_use
        if (block.type === "tool_use" && block.id && block.name) {
          const msgTime = new Date(msg.timestamp).getTime();
          toolUseMap.set(block.id, {
            name: block.name,
            input: block.input || {},
            startTime: msgTime - sessionStartTime,
          });
        }

        // Match tool_result with tool_use
        if (block.type === "tool_result" && block.tool_use_id) {
          const toolUse = toolUseMap.get(block.tool_use_id);
          if (toolUse) {
            // Extract tool output content
            let toolOutput = "";
            if (typeof block.content === "string") {
              toolOutput = block.content;
            } else if (Array.isArray(block.content)) {
              toolOutput = JSON.stringify(block.content);
            }

            toolCallsData.push({
              id: crypto.randomUUID(),
              sessionId: msg.sessionId,
              parentId: null,
              uuid: msg.uuid,
              parentUuid: msg.parentUuid,
              agentId: msg.agentId,
              toolName: toolUse.name,
              toolInput: JSON.stringify(toolUse.input),
              toolOutput,
              durationMs: msg.toolUseResult?.durationMs || 0,
              startTime: toolUse.startTime,
              isError: block.is_error || false,
              errorMessage: block.is_error ? block.content : null,
              timestamp: msg.timestamp,
            });
          }
        }
      }
    }
  }

  // Calculate total duration
  const startTime = new Date(firstMsg.timestamp).getTime();
  const endTime = new Date(lastMsg.timestamp).getTime();
  const totalDurationMs = endTime - startTime;

  // Extract project name from cwd
  const projectName = firstMsg.cwd?.split("/").pop() || "unknown";

  const session: NewSession = {
    id: firstMsg.sessionId,
    projectDir: firstMsg.cwd || "",
    projectName,
    gitBranch: firstMsg.gitBranch,
    model: firstMsg.message?.model,
    version: firstMsg.version,
    startedAt: firstMsg.timestamp,
    endedAt: lastMsg.timestamp,
    totalDurationMs,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    toolCallCount: toolCallsData.length,
    subAgentCount: subAgents.size,
    status: "completed",
    createdAt: new Date().toISOString(),
  };

  return {
    session,
    toolCalls: toolCallsData,
    messages: messagesData,
  };
}
