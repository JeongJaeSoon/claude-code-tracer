import { and, desc, eq, gte, inArray, like, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.ts";
import { messages, sessions } from "../db/schema.ts";

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

// Helper: Get date threshold for date range filter
function getDateThreshold(dateRange: string): string | null {
	const now = new Date();
	switch (dateRange) {
		case "today":
			now.setHours(0, 0, 0, 0);
			return now.toISOString();
		case "week":
			now.setDate(now.getDate() - 7);
			return now.toISOString();
		case "month":
			now.setMonth(now.getMonth() - 1);
			return now.toISOString();
		default:
			return null;
	}
}

// GET /api/projects - List all projects with aggregated stats
app.get("/", async (c) => {
	try {
		const search = c.req.query("search");
		const dateRange = c.req.query("dateRange");

		// Build where conditions
		const conditions: ReturnType<typeof eq>[] = [];

		// Text search (projectName)
		if (search) {
			conditions.push(sql`${sessions.projectName} LIKE ${"%" + search + "%"}`);
		}

		// Date range filter (filter by lastSessionAt)
		const dateThreshold = getDateThreshold(dateRange || "");
		if (dateThreshold) {
			conditions.push(gte(sessions.startedAt, dateThreshold));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const projects = await db
			.select({
				projectName: sessions.projectName,
				projectDir: sessions.projectDir,
				sessionCount: sql<number>`count(*)`.as("session_count"),
				totalDurationMs:
					sql<number>`coalesce(sum(${sessions.totalDurationMs}), 0)`.as(
						"total_duration_ms",
					),
				totalInputTokens:
					sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`.as(
						"total_input_tokens",
					),
				totalOutputTokens:
					sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`.as(
						"total_output_tokens",
					),
				totalToolCalls:
					sql<number>`coalesce(sum(${sessions.toolCallCount}), 0)`.as(
						"total_tool_calls",
					),
				lastSessionAt: sql<string>`max(${sessions.startedAt})`.as(
					"last_session_at",
				),
				firstSessionAt: sql<string>`min(${sessions.startedAt})`.as(
					"first_session_at",
				),
			})
			.from(sessions)
			.where(whereClause)
			.groupBy(sessions.projectName)
			.orderBy(desc(sql`max(${sessions.startedAt})`));

		return c.json({
			projects: projects as ProjectStats[],
			total: projects.length,
		});
	} catch (error) {
		console.error("Projects list error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

// GET /api/projects/:projectName/sessions - Get sessions for a specific project
app.get("/:projectName/sessions", async (c) => {
	try {
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

		// Get first user message for each session
		const sessionIds = projectSessions.map((s) => s.id);
		let firstPrompts: Record<string, string> = {};

		if (sessionIds.length > 0) {
			const firstMessages = await db
				.select({
					sessionId: messages.sessionId,
					content: messages.content,
				})
				.from(messages)
				.where(
					and(
						inArray(messages.sessionId, sessionIds),
						eq(messages.type, "user"),
						sql`(${messages.parentUuid} IS NULL OR ${messages.parentUuid} = '')`,
						sql`${messages.content} != 'Warmup'`,
					),
				)
				.orderBy(messages.timestamp);

			for (const msg of firstMessages) {
				if (!firstPrompts[msg.sessionId] && msg.content) {
					firstPrompts[msg.sessionId] = msg.content;
				}
			}
		}

		const sessionsWithPrompt = projectSessions.map((s) => ({
			...s,
			firstPrompt: firstPrompts[s.id] || null,
		}));

		return c.json({
			sessions: sessionsWithPrompt,
			total: totalResult[0]?.count || 0,
			limit,
			offset,
		});
	} catch (error) {
		console.error("Project sessions error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

// GET /api/projects/stats - Overall statistics
app.get("/stats", async (c) => {
	try {
		const result = await db
			.select({
				totalProjects: sql<number>`count(distinct ${sessions.projectName})`.as(
					"total_projects",
				),
				totalSessions: sql<number>`count(*)`.as("total_sessions"),
				totalInputTokens:
					sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`.as(
						"total_input_tokens",
					),
				totalOutputTokens:
					sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`.as(
						"total_output_tokens",
					),
				totalToolCalls:
					sql<number>`coalesce(sum(${sessions.toolCallCount}), 0)`.as(
						"total_tool_calls",
					),
				avgDurationMs:
					sql<number>`coalesce(avg(${sessions.totalDurationMs}), 0)`.as(
						"avg_duration_ms",
					),
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
	} catch (error) {
		console.error("Projects stats error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

export { app as projectsRoutes };
