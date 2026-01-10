import { Hono } from "hono";
import { db } from "../db/client.ts";
import { sessions } from "../db/schema.ts";
import { sql, desc, eq } from "drizzle-orm";

const app = new Hono();

interface ProjectStats {
  projectName: string;
  projectDir: string;
  sessionCount: number;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolCalls: number;
  lastSessionAt: string;
  firstSessionAt: string;
}

// GET /api/projects - List all projects with aggregated stats
app.get("/", async (c) => {
  const projects = await db
    .select({
      projectName: sessions.projectName,
      projectDir: sessions.projectDir,
      sessionCount: sql<number>`count(*)`.as("session_count"),
      totalDurationMs: sql<number>`coalesce(sum(${sessions.totalDurationMs}), 0)`.as("total_duration_ms"),
      totalInputTokens: sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`.as("total_input_tokens"),
      totalOutputTokens: sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`.as("total_output_tokens"),
      totalToolCalls: sql<number>`coalesce(sum(${sessions.toolCallCount}), 0)`.as("total_tool_calls"),
      lastSessionAt: sql<string>`max(${sessions.startedAt})`.as("last_session_at"),
      firstSessionAt: sql<string>`min(${sessions.startedAt})`.as("first_session_at"),
    })
    .from(sessions)
    .groupBy(sessions.projectName)
    .orderBy(desc(sql`max(${sessions.startedAt})`));

  return c.json({
    projects: projects as ProjectStats[],
    total: projects.length,
  });
});

// GET /api/projects/:projectName/sessions - Get sessions for a specific project
app.get("/:projectName/sessions", async (c) => {
  const projectName = decodeURIComponent(c.req.param("projectName"));
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  const projectSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.projectName, projectName))
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(eq(sessions.projectName, projectName));

  return c.json({
    sessions: projectSessions,
    total: totalResult[0]?.count || 0,
    limit,
    offset,
  });
});

// GET /api/projects/stats - Overall statistics
app.get("/stats", async (c) => {
  const result = await db
    .select({
      totalProjects: sql<number>`count(distinct ${sessions.projectName})`.as("total_projects"),
      totalSessions: sql<number>`count(*)`.as("total_sessions"),
      totalInputTokens: sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`.as("total_input_tokens"),
      totalOutputTokens: sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`.as("total_output_tokens"),
      totalToolCalls: sql<number>`coalesce(sum(${sessions.toolCallCount}), 0)`.as("total_tool_calls"),
      avgDurationMs: sql<number>`coalesce(avg(${sessions.totalDurationMs}), 0)`.as("avg_duration_ms"),
    })
    .from(sessions);

  const stats = result[0];

  return c.json({
    totalProjects: stats?.totalProjects || 0,
    totalSessions: stats?.totalSessions || 0,
    totalTokens: {
      input: stats?.totalInputTokens || 0,
      output: stats?.totalOutputTokens || 0,
    },
    totalToolCalls: stats?.totalToolCalls || 0,
    avgDurationMs: Math.round(stats?.avgDurationMs || 0),
  });
});

export { app as projectsRoutes };
