import { Hono } from "hono";
import type {
	IRepository,
	MessageData,
	SessionData,
	ToolCallData,
} from "../repositories/types.ts";
import { parseJSONL } from "../services/parser.ts";

/**
 * Ingest 라우트 팩토리 함수
 * Repository를 주입받아 데이터 수집 API를 제공합니다.
 * Server mode에서만 사용됩니다.
 */
export function createIngestRoutes(repo: IRepository) {
	const app = new Hono();

	// POST /api/ingest - Receive raw JSONL data from Stop hook
	app.post("/", async (c) => {
		try {
			const body = await c.req.text();
			const result = await parseJSONL(body);

			if (!result.session) {
				return c.json({ error: "Failed to parse session data" }, 400);
			}

			// Check if repository supports ingest
			if (!repo.ingestSession) {
				return c.json({ error: "Ingest not supported in this mode" }, 405);
			}

			// Convert parsed data to repository types
			const sessionData: SessionData = {
				id: result.session.id,
				projectDir: result.session.projectDir,
				projectName: result.session.projectName,
				gitBranch: result.session.gitBranch ?? null,
				model: result.session.model ?? null,
				version: result.session.version ?? null,
				startedAt: result.session.startedAt,
				endedAt: result.session.endedAt ?? null,
				totalDurationMs: result.session.totalDurationMs ?? null,
				inputTokens: result.session.inputTokens ?? 0,
				outputTokens: result.session.outputTokens ?? 0,
				cacheReadTokens: result.session.cacheReadTokens ?? 0,
				cacheCreationTokens: result.session.cacheCreationTokens ?? 0,
				toolCallCount: result.session.toolCallCount ?? 0,
				subAgentCount: result.session.subAgentCount ?? 0,
				status: result.session.status ?? "completed",
				createdAt: result.session.createdAt,
			};

			const toolCallsData: ToolCallData[] = result.toolCalls.map((tc) => ({
				id: tc.id,
				sessionId: tc.sessionId,
				parentId: tc.parentId ?? null,
				uuid: tc.uuid,
				parentUuid: tc.parentUuid ?? null,
				agentId: tc.agentId ?? null,
				toolName: tc.toolName,
				toolInput: tc.toolInput ?? null,
				toolOutput: tc.toolOutput ?? null,
				durationMs: tc.durationMs ?? null,
				startTime: tc.startTime,
				isError: tc.isError ?? false,
				errorMessage: tc.errorMessage ?? null,
				timestamp: tc.timestamp,
			}));

			const messagesData: MessageData[] = result.messages.map((msg) => ({
				id: msg.id,
				sessionId: msg.sessionId,
				uuid: msg.uuid,
				parentUuid: msg.parentUuid ?? null,
				type: msg.type as "user" | "assistant" | "summary",
				agentId: msg.agentId ?? null,
				isSidechain: msg.isSidechain ?? false,
				content: msg.content ?? null,
				thinking: msg.thinking ?? null,
				timestamp: msg.timestamp,
			}));

			await repo.ingestSession(sessionData, toolCallsData, messagesData);

			return c.json({
				success: true,
				sessionId: result.session.id,
				toolCallCount: toolCallsData.length,
				messageCount: messagesData.length,
			});
		} catch (error) {
			console.error("Ingest error:", error);
			return c.json({ error: String(error) }, 500);
		}
	});

	return app;
}

// Legacy export for backwards compatibility during migration
export { createIngestRoutes as ingestRoutes };
