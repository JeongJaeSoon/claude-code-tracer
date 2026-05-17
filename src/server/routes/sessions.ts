import { Hono } from "hono";
import type { IRepository } from "../repositories/types.ts";

/**
 * Sessions 라우트 팩토리 함수
 * Repository를 주입받아 세션 관련 API를 제공합니다.
 */
export function createSessionsRoutes(
	repo: IRepository,
	mode: "local" | "server",
) {
	const app = new Hono();

	// GET /api/sessions - List all sessions with filters
	app.get("/", async (c) => {
		try {
			const options = {
				limit: Number(c.req.query("limit")) || 50,
				offset: Number(c.req.query("offset")) || 0,
				search: c.req.query("search"),
				status: c.req.query("status"),
				dateRange: c.req.query("dateRange"),
				tool: c.req.query("tool"),
				duration: c.req.query("duration"),
				minTokens: c.req.query("minTokens"),
				maxTokens: c.req.query("maxTokens"),
			};

			const result = await repo.getSessions(options);

			return c.json({
				sessions: result.sessions,
				total: result.total,
				limit: options.limit,
				offset: options.offset,
			});
		} catch (error) {
			console.error("Sessions list error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	// GET /api/sessions/stats - Get aggregated stats
	app.get("/stats", async (c) => {
		try {
			const stats = await repo.getSessionStats();
			return c.json(stats);
		} catch (error) {
			console.error("Sessions stats error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	// GET /api/sessions/:id - Get session details
	app.get("/:id", async (c) => {
		try {
			const id = c.req.param("id");
			const session = await repo.getSessionById(id);

			if (!session) {
				return c.json({ error: "Session not found" }, 404);
			}

			return c.json(session);
		} catch (error) {
			console.error("Session detail error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	// DELETE /api/sessions/:id - Delete a session (server mode only)
	if (mode === "server") {
		app.delete("/:id", async (c) => {
			try {
				const id = c.req.param("id");

				if (!repo.deleteSession) {
					return c.json({ error: "Delete not supported in this mode" }, 405);
				}

				await repo.deleteSession(id);
				return c.json({ success: true });
			} catch (error) {
				console.error("Session delete error:", error);
				return c.json({ error: String(error) }, 500);
			}
		});
	}

	return app;
}

// Legacy export for backwards compatibility during migration
export { createSessionsRoutes as sessionsRoutes };
