import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";

import { ingestRoutes } from "./routes/ingest.ts";
import { sessionsRoutes } from "./routes/sessions.ts";
import { projectsRoutes } from "./routes/projects.ts";
import { timelineRoutes } from "./routes/timeline.ts";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
	"*",
	cors({
		origin: ["http://localhost:5173", "http://localhost:8080"],
		allowMethods: ["GET", "POST", "PUT", "DELETE"],
	}),
);

// API Routes
app.route("/api/ingest", ingestRoutes);
app.route("/api/sessions", sessionsRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/timeline", timelineRoutes);

// Health check
app.get("/api/health", (c) =>
	c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// Serve static files in production
app.use("/*", serveStatic({ root: "./dist/client" }));
app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));

const port = Number(process.env.PORT) || 8080;

console.log(`🔥 Claude Code Tracer server running at http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
