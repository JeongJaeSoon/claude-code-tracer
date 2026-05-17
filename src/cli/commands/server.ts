import { existsSync } from "node:fs";
import { createApp } from "../../server/index.ts";
import { DbRepository } from "../../server/repositories/db-repository.ts";
import { openBrowser } from "../utils/browser.ts";
import { findAvailablePort } from "../utils/port.ts";

// Parse arguments
const args = process.argv.slice(2);
const noOpen = args.includes("--no-open");
const portArg = args.find(
	(a) => a.startsWith("--port=") || a.startsWith("-p="),
);
const requestedPort = portArg ? Number(portArg.split("=")[1]) : 8080;

async function startServerMode() {
	// Check if frontend build exists
	const distClientPath = "./dist/client/index.html";
	if (!existsSync(distClientPath)) {
		console.error("Frontend build not found!");
		console.error("");
		console.error("Please build the frontend first:");
		console.error("  bun run build");
		console.error("");
		console.error("Or run in development mode:");
		console.error("  bun run dev:server  (terminal 1)");
		console.error("  bun run dev:client  (terminal 2)");
		process.exit(1);
	}

	console.log("Starting Claude Code Tracer in server mode...");

	// Create database repository
	const repository = new DbRepository();

	// Find available port
	const port = await findAvailablePort(requestedPort);
	if (port !== requestedPort) {
		console.log(`Port ${requestedPort} is busy, using port ${port}`);
	}

	// Create and start server
	const app = createApp({ mode: "server", port, repository });

	const server = Bun.serve({
		port,
		fetch: app.fetch,
	});

	console.log(`🔥 Server running at http://localhost:${port}`);
	console.log("Mode: server (database, read-write)");
	console.log("");
	console.log(`Stop Hook endpoint: POST http://localhost:${port}/api/ingest`);

	// Open browser
	if (!noOpen) {
		await openBrowser(`http://localhost:${port}`);
	}

	// Graceful shutdown
	process.on("SIGINT", () => {
		console.log("\nShutting down...");
		server.stop();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		console.log("\nShutting down...");
		server.stop();
		process.exit(0);
	});
}

startServerMode().catch((err) => {
	console.error("Failed to start server mode:", err);
	process.exit(1);
});
