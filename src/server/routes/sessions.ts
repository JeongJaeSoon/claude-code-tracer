import { Hono } from "hono";
import { db } from "../db/client.ts";
import { sessions, toolCalls, messages } from "../db/schema.ts";
import { desc, eq, sql } from "drizzle-orm";

export const sessionsRoutes = new Hono();

// GET /api/sessions - List all sessions
sessionsRoutes.get("/", async (c) => {
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  const result = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions);

  return c.json({
    sessions: result,
    total: countResult[0]?.count || 0,
    limit,
    offset,
  });
});

// GET /api/sessions/stats - Get aggregated stats
sessionsRoutes.get("/stats", async (c) => {
  const totalSessions = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions);

  const totalTokens = await db
    .select({
      inputTokens: sql<number>`sum(input_tokens)`,
      outputTokens: sql<number>`sum(output_tokens)`,
      cacheReadTokens: sql<number>`sum(cache_read_tokens)`,
    })
    .from(sessions);

  const totalToolCalls = await db
    .select({ count: sql<number>`count(*)` })
    .from(toolCalls);

  const avgDuration = await db
    .select({ avg: sql<number>`avg(total_duration_ms)` })
    .from(sessions)
    .where(sql`total_duration_ms IS NOT NULL`);

  return c.json({
    totalSessions: totalSessions[0]?.count || 0,
    totalTokens: {
      input: totalTokens[0]?.inputTokens || 0,
      output: totalTokens[0]?.outputTokens || 0,
      cacheRead: totalTokens[0]?.cacheReadTokens || 0,
    },
    totalToolCalls: totalToolCalls[0]?.count || 0,
    avgDurationMs: Math.round(avgDuration[0]?.avg || 0),
  });
});

// GET /api/sessions/:id - Get session details
sessionsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (session.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  const sessionToolCalls = await db
    .select()
    .from(toolCalls)
    .where(eq(toolCalls.sessionId, id))
    .orderBy(toolCalls.startTime);

  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.timestamp);

  return c.json({
    ...session[0],
    toolCalls: sessionToolCalls,
    messages: sessionMessages,
  });
});

// DELETE /api/sessions/:id - Delete a session
sessionsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  await db.delete(sessions).where(eq(sessions.id, id));

  return c.json({ success: true });
});
