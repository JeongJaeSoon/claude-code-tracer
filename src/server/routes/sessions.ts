import { Hono } from "hono";
import { db } from "../db/client.ts";
import { sessions, toolCalls, messages } from "../db/schema.ts";
import { desc, eq, sql, and, like, gte, lte, inArray } from "drizzle-orm";

export const sessionsRoutes = new Hono();

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

// Helper: Get duration range in ms
function getDurationRange(
	duration: string,
): { min: number; max: number } | null {
	switch (duration) {
		case "fast":
			return { min: 0, max: 30000 }; // < 30s
		case "normal":
			return { min: 30000, max: 300000 }; // 30s - 5m
		case "slow":
			return { min: 300000, max: Number.MAX_SAFE_INTEGER }; // > 5m
		default:
			return null;
	}
}

// GET /api/sessions - List all sessions with filters
sessionsRoutes.get("/", async (c) => {
	try {
		const limit = Number(c.req.query("limit")) || 50;
		const offset = Number(c.req.query("offset")) || 0;
		const search = c.req.query("search");
		const status = c.req.query("status");
		const dateRange = c.req.query("dateRange");
		const tool = c.req.query("tool");
		const duration = c.req.query("duration");
		const minTokens = c.req.query("minTokens");
		const maxTokens = c.req.query("maxTokens");

		// Build where conditions
		const conditions: (
			| ReturnType<typeof eq>
			| ReturnType<typeof like>
			| ReturnType<typeof gte>
			| ReturnType<typeof lte>
		)[] = [];

		// Text search (sessionId or projectName)
		if (search) {
			conditions.push(
				sql`(${sessions.id} LIKE ${"%" + search + "%"} OR ${sessions.projectName} LIKE ${"%" + search + "%"})`,
			);
		}

		// Status filter
		if (status && status !== "all") {
			conditions.push(
				eq(sessions.status, status as "completed" | "running" | "error"),
			);
		}

		// Date range filter
		const dateThreshold = getDateThreshold(dateRange || "");
		if (dateThreshold) {
			conditions.push(gte(sessions.startedAt, dateThreshold));
		}

		// Duration filter
		const durationRange = getDurationRange(duration || "");
		if (durationRange) {
			conditions.push(gte(sessions.totalDurationMs, durationRange.min));
			conditions.push(lte(sessions.totalDurationMs, durationRange.max));
		}

		// Token filters
		if (minTokens) {
			const minVal = Number(minTokens);
			if (!isNaN(minVal)) {
				conditions.push(
					sql`(${sessions.inputTokens} + ${sessions.outputTokens}) >= ${minVal}`,
				);
			}
		}
		if (maxTokens) {
			const maxVal = Number(maxTokens);
			if (!isNaN(maxVal)) {
				conditions.push(
					sql`(${sessions.inputTokens} + ${sessions.outputTokens}) <= ${maxVal}`,
				);
			}
		}

		// Tool filter - get session IDs that used specific tool
		let sessionIdsWithTool: string[] | null = null;
		if (tool) {
			const toolResult = await db
				.select({ sessionId: toolCalls.sessionId })
				.from(toolCalls)
				.where(eq(toolCalls.toolName, tool))
				.groupBy(toolCalls.sessionId);
			sessionIdsWithTool = toolResult.map((r) => r.sessionId);

			if (sessionIdsWithTool.length === 0) {
				// No sessions use this tool
				return c.json({
					sessions: [],
					total: 0,
					limit,
					offset,
				});
			}
			conditions.push(inArray(sessions.id, sessionIdsWithTool));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const result = await db
			.select()
			.from(sessions)
			.where(whereClause)
			.orderBy(desc(sessions.startedAt))
			.limit(limit)
			.offset(offset);

		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(sessions)
			.where(whereClause);

		return c.json({
			sessions: result,
			total: countResult[0]?.count || 0,
			limit,
			offset,
		});
	} catch (error) {
		console.error("Sessions list error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

// GET /api/sessions/stats - Get aggregated stats
sessionsRoutes.get("/stats", async (c) => {
	try {
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
	} catch (error) {
		console.error("Sessions stats error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

// GET /api/sessions/:id - Get session details
sessionsRoutes.get("/:id", async (c) => {
	try {
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
	} catch (error) {
		console.error("Session detail error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

// DELETE /api/sessions/:id - Delete a session
sessionsRoutes.delete("/:id", async (c) => {
	try {
		const id = c.req.param("id");

		await db.delete(sessions).where(eq(sessions.id, id));

		return c.json({ success: true });
	} catch (error) {
		console.error("Session delete error:", error);
		return c.json({ error: String(error) }, 500);
	}
});
