import { Hono } from "hono";
import { db } from "../db/client.ts";
import { sessions, toolCalls, messages } from "../db/schema.ts";
import { eq, asc } from "drizzle-orm";

const app = new Hono();

// Types for Timeline API response
interface PromptBlock {
  id: string;
  content: string;
  startTime: number;
  timestamp: string;
}

interface AssistantMessage {
  id: string;
  content: string;
  timestamp: string;
}

interface TurnStep {
  id: string;
  type: "thinking" | "assistant_text" | "tool";
  content: string;
  timestamp: string;
  startTime: number;
  // tool-specific fields
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  toolDuration?: number;
  isError?: boolean;
}

interface Turn {
  id: string;
  userPrompt: PromptBlock;
  steps: TurnStep[];
  finalResponse: AssistantMessage | null;
  startTime: number;
  endTime: number;
  toolCount: number;
}

interface TimelineLane {
  id: string;
  name: string;
  color: string;
  turns: Turn[];
}

interface TimelineData {
  session: {
    id: string;
    projectName: string;
    startedAt: string;
    endedAt: string | null;
    totalDurationMs: number | null;
  };
  lanes: TimelineLane[];
}

// Lane colors
const LANE_COLORS: Record<string, string> = {
  main: "#8b5cf6",      // purple
  subagent: "#0891b2",  // cyan
};

// Tool colors for consistent coloring
const TOOL_COLORS: Record<string, string> = {
  bash: "#f97316",
  read: "#22c55e",
  edit: "#3b82f6",
  write: "#8b5cf6",
  grep: "#eab308",
  glob: "#06b6d4",
  task: "#ec4899",
  webfetch: "#6366f1",
  websearch: "#6366f1",
  todowrite: "#14b8a6",
};

// Combined event type for sorting
interface TimelineEvent {
  id: string;
  type: "user" | "assistant" | "tool";
  timestamp: string;
  agentId: string | null;
  content?: string;
  thinking?: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  toolDuration?: number;
  startTime?: number;
  isError?: boolean;
}

// GET /api/timeline/:sessionId - Get timeline data for visualization
app.get("/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");

    // Fetch session
    const sessionResult = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (sessionResult.length === 0) {
      return c.json({ error: "Session not found" }, 404);
    }

  const session = sessionResult[0]!;

  // Fetch all messages for this session
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.timestamp));

  // Fetch all tool calls for this session
  const allToolCalls = await db
    .select()
    .from(toolCalls)
    .where(eq(toolCalls.sessionId, sessionId))
    .orderBy(asc(toolCalls.timestamp));

  const sessionStartTime = new Date(session.startedAt).getTime();

  // Convert to unified events and sort by timestamp
  const events: TimelineEvent[] = [];

  for (const msg of allMessages) {
    events.push({
      id: msg.uuid,
      type: msg.type as "user" | "assistant",
      timestamp: msg.timestamp,
      agentId: msg.agentId,
      content: msg.content || "",
      thinking: msg.thinking || "",
    });
  }

  for (const tool of allToolCalls) {
    events.push({
      id: tool.id,
      type: "tool",
      timestamp: tool.timestamp,
      agentId: tool.agentId,
      toolName: tool.toolName,
      toolInput: formatToolInput(tool.toolName, tool.toolInput),
      toolOutput: tool.toolOutput || "",
      toolDuration: tool.durationMs || 0,
      startTime: tool.startTime,
      isError: tool.isError || false,
    });
  }

  // Sort all events by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Group by agentId and build turns
  const laneMap = new Map<string, TimelineLane>();

  // Initialize main agent lane
  laneMap.set("main", {
    id: "main",
    name: "Main Agent",
    color: LANE_COLORS.main || "#8b5cf6",
    turns: [],
  });

  // Group events by agent
  const eventsByAgent = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const agentId = event.agentId || "main";
    if (!eventsByAgent.has(agentId)) {
      eventsByAgent.set(agentId, []);
    }
    eventsByAgent.get(agentId)!.push(event);
  }

  // Process each agent's events to build turns
  for (const [agentId, agentEvents] of eventsByAgent) {
    const laneId = agentId;
    const laneName = agentId === "main" ? "Main Agent" : `Sub-agent: ${agentId.slice(0, 7)}`;

    // Ensure lane exists
    if (!laneMap.has(laneId)) {
      laneMap.set(laneId, {
        id: laneId,
        name: laneName,
        color: LANE_COLORS.subagent || "#0891b2",
        turns: [],
      });
    }

    const lane = laneMap.get(laneId)!;
    let currentTurn: Turn | null = null;

    for (const event of agentEvents) {
      const eventTime = new Date(event.timestamp).getTime();
      const relativeTime = eventTime - sessionStartTime;

      if (event.type === "user") {
        // Skip empty user messages (tool_result only)
        const content = event.content?.trim() || "";
        if (!content) continue;

        // Start a new turn
        if (currentTurn) {
          // Finalize previous turn - remove duplicate finalResponse from steps
          if (currentTurn.finalResponse) {
            currentTurn.steps = currentTurn.steps.filter(
              (s) => s.id !== currentTurn!.finalResponse!.id
            );
          }
          currentTurn.endTime = relativeTime;
          lane.turns.push(currentTurn);
        }

        currentTurn = {
          id: event.id,
          userPrompt: {
            id: event.id,
            content: content,
            startTime: relativeTime,
            timestamp: event.timestamp,
          },
          steps: [],
          finalResponse: null,
          startTime: relativeTime,
          endTime: relativeTime,
          toolCount: 0,
        };
      } else if (event.type === "assistant" && currentTurn) {
        const content = event.content?.trim() || "";
        const thinking = event.thinking?.trim() || "";

        // Add thinking step first (if exists)
        if (thinking) {
          currentTurn.steps.push({
            id: `${event.id}-thinking`,
            type: "thinking",
            content: thinking,
            timestamp: event.timestamp,
            startTime: relativeTime,
          });
        }

        // Add assistant text step
        if (content) {
          currentTurn.steps.push({
            id: event.id,
            type: "assistant_text",
            content: content,
            timestamp: event.timestamp,
            startTime: relativeTime,
          });

          // Update final response (will be overwritten by later responses)
          currentTurn.finalResponse = {
            id: event.id,
            content: content,
            timestamp: event.timestamp,
          };
        }

        currentTurn.endTime = relativeTime;
      } else if (event.type === "tool" && currentTurn) {
        // Add tool as step
        currentTurn.steps.push({
          id: event.id,
          type: "tool",
          content: `${event.toolName}: ${event.toolInput || ""}`,
          timestamp: event.timestamp,
          startTime: event.startTime ?? relativeTime,
          toolName: event.toolName,
          toolInput: event.toolInput,
          toolOutput: event.toolOutput,
          toolDuration: event.toolDuration,
          isError: event.isError,
        });

        currentTurn.toolCount++;
        currentTurn.endTime = relativeTime + (event.toolDuration || 0);
      }
    }

    // Add last turn - remove duplicate finalResponse from steps
    if (currentTurn) {
      if (currentTurn.finalResponse) {
        currentTurn.steps = currentTurn.steps.filter(
          (s) => s.id !== currentTurn!.finalResponse!.id
        );
      }
      lane.turns.push(currentTurn);
    }
  }

  // Convert map to array, main lane first
  const lanes: TimelineLane[] = [];
  const mainLane = laneMap.get("main");
  if (mainLane && mainLane.turns.length > 0) {
    lanes.push(mainLane);
    laneMap.delete("main");
  }

  // Add sub-agent lanes sorted by first activity
  const subLanes = Array.from(laneMap.values())
    .filter(lane => lane.turns.length > 0)
    .sort((a, b) => {
      const aFirstTime = a.turns[0]?.startTime ?? 0;
      const bFirstTime = b.turns[0]?.startTime ?? 0;
      return aFirstTime - bFirstTime;
    });
  lanes.push(...subLanes);

    const timelineData: TimelineData = {
      session: {
        id: session.id,
        projectName: session.projectName,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        totalDurationMs: session.totalDurationMs,
      },
      lanes,
    };

    return c.json(timelineData);
  } catch (error) {
    console.error("Timeline fetch error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// GET /api/timeline/:sessionId/colors - Get tool colors mapping
app.get("/:sessionId/colors", (c) => {
  return c.json({ toolColors: TOOL_COLORS, laneColors: LANE_COLORS });
});

function truncateContent(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen - 3) + "...";
}

function formatToolInput(toolName: string, input: string | null): string {
  if (!input) return "";

  try {
    const parsed = JSON.parse(input);
    if (parsed.command) return parsed.command.slice(0, 60);
    if (parsed.file_path) return parsed.file_path;
    if (parsed.pattern) return parsed.pattern;
    if (parsed.description) return parsed.description.slice(0, 60);
    if (parsed.query) return parsed.query.slice(0, 60);
    if (parsed.url) return parsed.url;
    return JSON.stringify(parsed).slice(0, 60);
  } catch {
    return input.slice(0, 60);
  }
}

export { app as timelineRoutes };
