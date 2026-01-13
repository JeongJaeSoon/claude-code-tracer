#!/usr/bin/env bun
/**
 * Claude Code Tracer CLI
 *
 * Usage:
 *   bun run cli local [--port=PORT] [--no-open]   - Start in local mode
 *   bun run cli server [--port=PORT] [--no-open]  - Start in server mode
 *   bun run cli help                              - Show help
 */

const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
	console.log(`
Claude Code Tracer CLI

Usage:
  bun run cli <command> [options]

Commands:
  local     Start in local mode (scan ~/.claude, in-memory, read-only)
  server    Start in server mode (database, read-write, Stop Hook enabled)
  help      Show this help message

Options:
  --port=PORT    Port to listen on (default: 8080)
  --no-open      Don't open browser automatically

Examples:
  bun run cli local                    # Start local mode on port 8080
  bun run cli local --port=3000        # Start local mode on port 3000
  bun run cli server --no-open         # Start server mode without opening browser

Local Mode:
  - Scans ~/.claude/projects directory
  - Loads all sessions into memory
  - Read-only (no ingest or delete)
  - Best for quickly viewing existing sessions

Server Mode:
  - Uses SQLite database
  - Supports POST /api/ingest for Stop Hook
  - Supports DELETE /api/sessions/:id
  - Best for continuous data collection
`);
}

async function main() {
	switch (command) {
		case "local":
			await import("./commands/local.ts");
			break;

		case "server":
			await import("./commands/server.ts");
			break;

		case "help":
		case "--help":
		case "-h":
		case undefined:
			showHelp();
			break;

		default:
			console.error(`Unknown command: ${command}`);
			console.error('Run "bun run cli help" for usage information.');
			process.exit(1);
	}
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
