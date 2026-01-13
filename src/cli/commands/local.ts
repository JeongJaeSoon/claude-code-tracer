import { existsSync } from "node:fs";
import { createApp } from "../../server/index.ts";
import { MemoryRepository } from "../../server/repositories/memory-repository.ts";
import { scanClaudeDirectory } from "../../server/services/scanner.ts";
import { openBrowser } from "../utils/browser.ts";
import { findAvailablePort } from "../utils/port.ts";

// Parse arguments
const args = process.argv.slice(2);
const noOpen = args.includes("--no-open");
const portArg = args.find(
	(a) => a.startsWith("--port=") || a.startsWith("-p="),
);
const requestedPort = portArg ? Number(portArg.split("=")[1]) : 8080;

async function startLocalMode() {
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

	console.log("Starting Claude Code Tracer in local mode...");
	console.log("Scanning ~/.claude directory...");

	// Scan directory
	const data = await scanClaudeDirectory();

	if (data.sessions.length === 0) {
		console.error("No sessions found in ~/.claude");
		console.error(
			"Make sure you have Claude Code sessions in ~/.claude/projects/",
		);
		process.exit(1);
	}

	console.log(`Found ${data.sessions.length} sessions`);

	// Create in-memory repository
	const repository = new MemoryRepository();
	repository.load(data);

	// Find available port
	const port = await findAvailablePort(requestedPort);
	if (port !== requestedPort) {
		console.log(`Port ${requestedPort} is busy, using port ${port}`);
	}

	// Create and start server
	const app = createApp({ mode: "local", port, repository });

	const server = Bun.serve({
		port,
		fetch: app.fetch,
	});

	console.log(`🔥 Server running at http://localhost:${port}`);
	console.log("Mode: local (in-memory, read-only)");

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

startLocalMode().catch((err) => {
	console.error("Failed to start local mode:", err);
	process.exit(1);
});
