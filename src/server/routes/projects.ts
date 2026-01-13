import { Hono } from "hono";
import type { IRepository } from "../repositories/types.ts";

/**
 * Projects 라우트 팩토리 함수
 * Repository를 주입받아 프로젝트 관련 API를 제공합니다.
 */
export function createProjectsRoutes(repo: IRepository) {
	const app = new Hono();

	// GET /api/projects - List all projects with aggregated stats
	app.get("/", async (c) => {
		try {
			const search = c.req.query("search");
			const limit = Number(c.req.query("limit")) || 100;
			const offset = Number(c.req.query("offset")) || 0;

			const result = await repo.getProjects({ limit, offset, search });

			return c.json({
				projects: result.projects,
				total: result.total,
			});
		} catch (error) {
			console.error("Projects list error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	// GET /api/projects/stats - Overall statistics
	app.get("/stats", async (c) => {
		try {
			const stats = await repo.getProjectStats();
			return c.json(stats);
		} catch (error) {
			console.error("Projects stats error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	// GET /api/projects/:projectName/sessions - Get sessions for a specific project
	app.get("/:projectName/sessions", async (c) => {
		try {
			const projectName = decodeURIComponent(c.req.param("projectName"));
			const limit = Number(c.req.query("limit")) || 50;
			const offset = Number(c.req.query("offset")) || 0;

			const result = await repo.getProjectSessions(projectName, {
				limit,
				offset,
			});

			return c.json({
				sessions: result.sessions,
				total: result.total,
				limit,
				offset,
			});
		} catch (error) {
			console.error("Project sessions error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	return app;
}

// Legacy export for backwards compatibility during migration
export { createProjectsRoutes as projectsRoutes };
