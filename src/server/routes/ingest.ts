import path from "node:path";
import { Hono } from "hono";
import { insertNewItems, upsertSession } from "../services/ingestHelpers.ts";
import { parseJSONL } from "../services/parser.ts";

export const ingestRoutes = new Hono();

// Allowed base path for file access (local-only endpoint)
const ALLOWED_BASE_PATH =
	process.env.CLAUDE_PROJECTS_DIR || `${process.env.HOME}/.claude`;

// POST /api/ingest - Receive JSONL data from Stop hook
ingestRoutes.post("/", async (c) => {
	try {
		const body = await c.req.text();
		const result = await parseJSONL(body);

		if (!result.session) {
			return c.json({ error: "Failed to parse session data" }, 400);
		}

		// Upsert session and insert new items
		await upsertSession(result.session);
		const { toolCallCount, messageCount } = await insertNewItems(
			result.session.id,
			result.toolCalls,
			result.messages,
		);

		return c.json({
			success: true,
			sessionId: result.session.id,
			toolCallCount,
			messageCount,
		});
	} catch (error) {
		console.error("Ingest error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

// POST /api/ingest/file - Receive file path and read it (includes sub-agents)
// Note: This endpoint is for local use only. Path must be within ~/.claude
ingestRoutes.post("/file", async (c) => {
	try {
		const { path: filePath } = await c.req.json<{ path: string }>();

		if (!filePath) {
			return c.json({ error: "path is required" }, 400);
		}

		// Path traversal prevention: resolve to absolute path and check prefix
		const resolvedPath = path.resolve(filePath);
		if (!resolvedPath.startsWith(ALLOWED_BASE_PATH)) {
			return c.json(
				{
					error: `Access denied: path must be within ${ALLOWED_BASE_PATH} directory`,
				},
				403,
			);
		}

		const file = Bun.file(resolvedPath);
		if (!(await file.exists())) {
			return c.json({ error: "File not found" }, 404);
		}

		// Parse main session file
		const content = await file.text();
		const result = await parseJSONL(content);

		if (!result.session) {
			return c.json({ error: "Failed to parse session data" }, 400);
		}

		// Check for sub-agents directory
		// Path: {sessionId}.jsonl -> {sessionId}/subagents/
		const sessionDir = resolvedPath.replace(".jsonl", "");
		const subagentsDir = `${sessionDir}/subagents`;

		let subAgentCount = 0;

		try {
			const { readdir } = await import("node:fs/promises");
			const files = await readdir(subagentsDir);

			for (const agentFile of files) {
				if (agentFile.endsWith(".jsonl")) {
					const subAgentPath = `${subagentsDir}/${agentFile}`;
					const subContent = await Bun.file(subAgentPath).text();
					const subResult = await parseJSONL(subContent);

					// Merge sub-agent data into main result
					if (subResult.toolCalls.length > 0) {
						result.toolCalls.push(...subResult.toolCalls);
					}
					if (subResult.messages.length > 0) {
						result.messages.push(...subResult.messages);
					}

					// Accumulate tokens
					if (subResult.session) {
						result.session.inputTokens =
							(result.session.inputTokens || 0) +
							(subResult.session.inputTokens || 0);
						result.session.outputTokens =
							(result.session.outputTokens || 0) +
							(subResult.session.outputTokens || 0);
						result.session.cacheReadTokens =
							(result.session.cacheReadTokens || 0) +
							(subResult.session.cacheReadTokens || 0);
					}

					subAgentCount++;
				}
			}
		} catch {
			// subagents directory doesn't exist or can't be read - that's fine
		}

		// Update counts
		result.session.toolCallCount = result.toolCalls.length;
		result.session.subAgentCount = subAgentCount;

		// Upsert session and insert new items
		await upsertSession(result.session);
		const { toolCallCount, messageCount } = await insertNewItems(
			result.session.id,
			result.toolCalls,
			result.messages,
		);

		return c.json({
			success: true,
			sessionId: result.session.id,
			toolCallCount,
			messageCount,
			subAgentCount,
		});
	} catch (error) {
		console.error("Ingest file error:", error);
		return c.json({ error: String(error) }, 500);
	}
});
