import { Hono } from "hono";
import { db } from "../db/client.ts";
import { sessions, toolCalls, messages } from "../db/schema.ts";
import { parseJSONL } from "../services/parser.ts";

export const ingestRoutes = new Hono();

// POST /api/ingest - Receive JSONL data from Stop hook
ingestRoutes.post("/", async (c) => {
  try {
    const body = await c.req.text();
    const result = await parseJSONL(body);

    if (!result.session) {
      return c.json({ error: "Failed to parse session data" }, 400);
    }

    // Insert session
    await db.insert(sessions).values(result.session).onConflictDoUpdate({
      target: sessions.id,
      set: {
        endedAt: result.session.endedAt,
        totalDurationMs: result.session.totalDurationMs,
        inputTokens: result.session.inputTokens,
        outputTokens: result.session.outputTokens,
        cacheReadTokens: result.session.cacheReadTokens,
        cacheCreationTokens: result.session.cacheCreationTokens,
        toolCallCount: result.session.toolCallCount,
        subAgentCount: result.session.subAgentCount,
        status: result.session.status,
      },
    });

    // Insert tool calls
    if (result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        await db.insert(toolCalls).values(toolCall).onConflictDoNothing();
      }
    }

    // Insert messages
    if (result.messages.length > 0) {
      for (const message of result.messages) {
        await db.insert(messages).values(message).onConflictDoNothing();
      }
    }

    return c.json({
      success: true,
      sessionId: result.session.id,
      toolCallCount: result.toolCalls.length,
      messageCount: result.messages.length,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// POST /api/ingest/file - Receive file path and read it
ingestRoutes.post("/file", async (c) => {
  try {
    const { path } = await c.req.json<{ path: string }>();

    if (!path) {
      return c.json({ error: "path is required" }, 400);
    }

    const file = Bun.file(path);
    if (!await file.exists()) {
      return c.json({ error: "File not found" }, 404);
    }

    const content = await file.text();
    const result = await parseJSONL(content);

    if (!result.session) {
      return c.json({ error: "Failed to parse session data" }, 400);
    }

    // Insert session
    await db.insert(sessions).values(result.session).onConflictDoUpdate({
      target: sessions.id,
      set: {
        endedAt: result.session.endedAt,
        totalDurationMs: result.session.totalDurationMs,
        inputTokens: result.session.inputTokens,
        outputTokens: result.session.outputTokens,
        cacheReadTokens: result.session.cacheReadTokens,
        cacheCreationTokens: result.session.cacheCreationTokens,
        toolCallCount: result.session.toolCallCount,
        subAgentCount: result.session.subAgentCount,
        status: result.session.status,
      },
    });

    // Insert tool calls
    if (result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        await db.insert(toolCalls).values(toolCall).onConflictDoNothing();
      }
    }

    // Insert messages
    if (result.messages.length > 0) {
      for (const message of result.messages) {
        await db.insert(messages).values(message).onConflictDoNothing();
      }
    }

    return c.json({
      success: true,
      sessionId: result.session.id,
      toolCallCount: result.toolCalls.length,
      messageCount: result.messages.length,
    });
  } catch (error) {
    console.error("Ingest file error:", error);
    return c.json({ error: String(error) }, 500);
  }
});
