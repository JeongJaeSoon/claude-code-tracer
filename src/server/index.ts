import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { IRepository } from "./repositories/types.ts";
import { createIngestRoutes } from "./routes/ingest.ts";
import { createProjectsRoutes } from "./routes/projects.ts";
import { createSessionsRoutes } from "./routes/sessions.ts";
import { createTimelineRoutes } from "./routes/timeline.ts";

/**
 * 서버 설정 인터페이스
 */
export interface ServerConfig {
	mode: "local" | "server";
	port: number;
	repository: IRepository;
}

/**
 * Hono 앱 팩토리 함수
 * 모드에 따라 다른 라우트 구성을 제공합니다.
 */
export function createApp(config: ServerConfig) {
	const app = new Hono();
	const { repository, mode, port } = config;

	// Middleware
	app.use("*", logger());
	app.use(
		"*",
		cors({
			origin: ["http://localhost:5173", `http://localhost:${port}`],
			allowMethods: ["GET", "POST", "PUT", "DELETE"],
		}),
	);

	// API Routes
	// Ingest route only available in server mode
	if (mode === "server") {
		app.route("/api/ingest", createIngestRoutes(repository));
	}
	app.route("/api/sessions", createSessionsRoutes(repository, mode));
	app.route("/api/projects", createProjectsRoutes(repository));
	app.route("/api/timeline", createTimelineRoutes(repository));

	// Health check
	app.get("/api/health", (c) =>
		c.json({ status: "ok", mode, timestamp: new Date().toISOString() }),
	);

	// Serve static files in production
	app.use("/assets/*", serveStatic({ root: "./dist/client" }));

	// SPA fallback - serve index.html for all non-API routes
	app.get("/*", async (c) => {
		const file = Bun.file("./dist/client/index.html");
		if (await file.exists()) {
			return c.html(await file.text());
		}
		return c.text("Frontend not found. Run 'bun run build' first.", 404);
	});

	return app;
}
