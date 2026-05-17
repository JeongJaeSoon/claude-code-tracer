import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { messages, sessions, toolCalls } from "../db/schema.ts";
import { getDateThreshold, getDurationRange } from "../utils/dateFilters.ts";
import type {
	IRepository,
	MessageData,
	OverallStats,
	ProjectQueryOptions,
	ProjectStats,
	SessionData,
	SessionDetail,
	SessionQueryOptions,
	SessionStats,
	SessionWithPrompt,
	ToolCallData,
} from "./types.ts";

// ============================================================================
// 타입 변환 헬퍼
// ============================================================================

/** Drizzle Session을 SessionData로 변환 */
function toSessionData(s: typeof sessions.$inferSelect): SessionData {
	return {
		id: s.id,
		projectDir: s.projectDir,
		projectName: s.projectName,
		gitBranch: s.gitBranch ?? null,
		model: s.model ?? null,
		version: s.version ?? null,
		startedAt: s.startedAt,
		endedAt: s.endedAt ?? null,
		totalDurationMs: s.totalDurationMs ?? null,
		inputTokens: s.inputTokens ?? 0,
		outputTokens: s.outputTokens ?? 0,
		cacheReadTokens: s.cacheReadTokens ?? 0,
		cacheCreationTokens: s.cacheCreationTokens ?? 0,
		toolCallCount: s.toolCallCount ?? 0,
		subAgentCount: s.subAgentCount ?? 0,
		status: s.status ?? "running",
		createdAt: s.createdAt,
	};
}

/** Drizzle ToolCall을 ToolCallData로 변환 */
function toToolCallData(tc: typeof toolCalls.$inferSelect): ToolCallData {
	return {
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
	};
}

/** Drizzle Message를 MessageData로 변환 */
function toMessageData(m: typeof messages.$inferSelect): MessageData {
	return {
		id: m.id,
		sessionId: m.sessionId,
		uuid: m.uuid,
		parentUuid: m.parentUuid ?? null,
		type: m.type,
		agentId: m.agentId ?? null,
		isSidechain: m.isSidechain ?? false,
		content: m.content ?? null,
		thinking: m.thinking ?? null,
		timestamp: m.timestamp,
	};
}

// ============================================================================
// DbRepository 구현
// ============================================================================

export class DbRepository implements IRepository {
	// -------------------------------------------------------------------------
	// Sessions
	// -------------------------------------------------------------------------

	async getSessions(
		options: SessionQueryOptions,
	): Promise<{ sessions: SessionWithPrompt[]; total: number }> {
		const {
			limit,
			offset,
			search,
			status,
			dateRange,
			tool,
			duration,
			minTokens,
			maxTokens,
		} = options;

		const conditions: ReturnType<typeof eq>[] = [];

		if (search) {
			conditions.push(
				sql`(${sessions.id} LIKE ${`%${search}%`} OR ${sessions.projectName} LIKE ${`%${search}%`})`,
			);
		}

		if (status && status !== "all") {
			conditions.push(
				eq(sessions.status, status as "completed" | "running" | "error"),
			);
		}

		const dateThreshold = getDateThreshold(dateRange || "");
		if (dateThreshold) {
			conditions.push(gte(sessions.startedAt, dateThreshold));
		}

		const durationRange = getDurationRange(duration || "");
		if (durationRange) {
			conditions.push(gte(sessions.totalDurationMs, durationRange.min));
			conditions.push(lte(sessions.totalDurationMs, durationRange.max));
		}

		if (minTokens) {
			const minVal = Number(minTokens);
			if (!Number.isNaN(minVal)) {
				conditions.push(
					sql`(${sessions.inputTokens} + ${sessions.outputTokens}) >= ${minVal}`,
				);
			}
		}
		if (maxTokens) {
			const maxVal = Number(maxTokens);
			if (!Number.isNaN(maxVal)) {
				conditions.push(
					sql`(${sessions.inputTokens} + ${sessions.outputTokens}) <= ${maxVal}`,
				);
			}
		}

		if (tool) {
			const sessionIdsWithTool = await this.getSessionIdsWithTool(tool);
			if (sessionIdsWithTool.length === 0) {
				return { sessions: [], total: 0 };
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

		const sessionIds = result.map((s) => s.id);
		const firstPrompts = await this.getFirstUserMessages(sessionIds);
		const toolTypes = await this.getToolTypesBySessionIds(sessionIds);

		const sessionsWithPrompt: SessionWithPrompt[] = result.map((s) => ({
			...toSessionData(s),
			firstPrompt: firstPrompts.get(s.id) ?? null,
			toolTypes: toolTypes.get(s.id) ?? [],
		}));

		return {
			sessions: sessionsWithPrompt,
			total: countResult[0]?.count || 0,
		};
	}

	async getSessionById(id: string): Promise<SessionDetail | null> {
		const result = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, id))
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		const session = result[0]!;
		const sessionToolCalls = await this.getToolCallsBySessionId(id);
		const sessionMessages = await this.getMessagesBySessionId(id);

		return {
			...toSessionData(session),
			toolCalls: sessionToolCalls,
			messages: sessionMessages,
		};
	}

	async getSessionStats(): Promise<SessionStats> {
		const totalSessions = await db
			.select({ count: sql<number>`count(*)` })
			.from(sessions);

		const totalTokens = await db
			.select({
				inputTokens: sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`,
				outputTokens: sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`,
				cacheReadTokens: sql<number>`coalesce(sum(${sessions.cacheReadTokens}), 0)`,
			})
			.from(sessions);

		const totalToolCalls = await db
			.select({ count: sql<number>`count(*)` })
			.from(toolCalls);

		const avgDuration = await db
			.select({ avg: sql<number>`avg(${sessions.totalDurationMs})` })
			.from(sessions)
			.where(sql`${sessions.totalDurationMs} IS NOT NULL`);

		return {
			totalSessions: totalSessions[0]?.count || 0,
			totalTokens: {
				input: totalTokens[0]?.inputTokens || 0,
				output: totalTokens[0]?.outputTokens || 0,
				cacheRead: totalTokens[0]?.cacheReadTokens || 0,
			},
			totalToolCalls: totalToolCalls[0]?.count || 0,
			avgDurationMs: Math.round(avgDuration[0]?.avg || 0),
		};
	}

	async deleteSession(id: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.id, id));
	}

	// -------------------------------------------------------------------------
	// ToolCalls
	// -------------------------------------------------------------------------

	async getToolCallsBySessionId(sessionId: string): Promise<ToolCallData[]> {
		const result = await db
			.select()
			.from(toolCalls)
			.where(eq(toolCalls.sessionId, sessionId))
			.orderBy(toolCalls.startTime);

		return result.map(toToolCallData);
	}

	async getSessionIdsWithTool(toolName: string): Promise<string[]> {
		const result = await db
			.select({ sessionId: toolCalls.sessionId })
			.from(toolCalls)
			.where(eq(toolCalls.toolName, toolName))
			.groupBy(toolCalls.sessionId);

		return result.map((r) => r.sessionId);
	}

	async getToolTypesBySessionIds(
		sessionIds: string[],
	): Promise<Map<string, string[]>> {
		const result = new Map<string, string[]>();

		if (sessionIds.length === 0) {
			return result;
		}

		const toolResults = await db
			.select({
				sessionId: toolCalls.sessionId,
				toolName: toolCalls.toolName,
			})
			.from(toolCalls)
			.where(inArray(toolCalls.sessionId, sessionIds))
			.groupBy(toolCalls.sessionId, toolCalls.toolName);

		for (const row of toolResults) {
			const existing = result.get(row.sessionId) || [];
			if (!existing.includes(row.toolName)) {
				existing.push(row.toolName);
			}
			result.set(row.sessionId, existing);
		}

		return result;
	}

	// -------------------------------------------------------------------------
	// Messages
	// -------------------------------------------------------------------------

	async getMessagesBySessionId(sessionId: string): Promise<MessageData[]> {
		const result = await db
			.select()
			.from(messages)
			.where(eq(messages.sessionId, sessionId))
			.orderBy(messages.timestamp);

		return result.map(toMessageData);
	}

	async getFirstUserMessages(
		sessionIds: string[],
	): Promise<Map<string, string | null>> {
		const result = new Map<string, string | null>();

		if (sessionIds.length === 0) {
			return result;
		}

		const firstMessages = await db
			.select({
				sessionId: messages.sessionId,
				content: messages.content,
			})
			.from(messages)
			.where(
				and(
					inArray(messages.sessionId, sessionIds),
					eq(messages.type, "user"),
					sql`(${messages.parentUuid} IS NULL OR ${messages.parentUuid} = '')`,
					sql`${messages.content} != 'Warmup'`,
				),
			)
			.orderBy(messages.timestamp);

		for (const msg of firstMessages) {
			if (!result.has(msg.sessionId) && msg.content) {
				result.set(msg.sessionId, msg.content);
			}
		}

		return result;
	}

	// -------------------------------------------------------------------------
	// Projects
	// -------------------------------------------------------------------------

	async getProjects(
		options: ProjectQueryOptions,
	): Promise<{ projects: ProjectStats[]; total: number }> {
		const { search } = options;

		const conditions: ReturnType<typeof eq>[] = [];

		if (search) {
			conditions.push(sql`${sessions.projectName} LIKE ${`%${search}%`}`);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const projectsResult = await db
			.select({
				projectName: sessions.projectName,
				projectDir: sessions.projectDir,
				sessionCount: sql<number>`count(*)`.as("session_count"),
				totalInputTokens:
					sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`.as(
						"total_input_tokens",
					),
				totalOutputTokens:
					sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`.as(
						"total_output_tokens",
					),
				totalToolCalls:
					sql<number>`coalesce(sum(${sessions.toolCallCount}), 0)`.as(
						"total_tool_calls",
					),
				lastSessionAt: sql<string>`max(${sessions.startedAt})`.as(
					"last_session_at",
				),
			})
			.from(sessions)
			.where(whereClause)
			.groupBy(sessions.projectName)
			.orderBy(desc(sql`max(${sessions.startedAt})`));

		const projects: ProjectStats[] = projectsResult.map((p) => ({
			projectName: p.projectName,
			projectDir: p.projectDir,
			sessionCount: p.sessionCount,
			lastSessionAt: p.lastSessionAt,
			totalTokens: p.totalInputTokens + p.totalOutputTokens,
			totalToolCalls: p.totalToolCalls,
		}));

		return {
			projects,
			total: projects.length,
		};
	}

	async getProjectSessions(
		projectName: string,
		options: { limit: number; offset: number },
	): Promise<{ sessions: SessionWithPrompt[]; total: number }> {
		const { limit, offset } = options;

		const projectSessions = await db
			.select()
			.from(sessions)
			.where(eq(sessions.projectName, projectName))
			.orderBy(desc(sessions.startedAt))
			.limit(limit)
			.offset(offset);

		const totalResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(sessions)
			.where(eq(sessions.projectName, projectName));

		const sessionIds = projectSessions.map((s) => s.id);
		const firstPrompts = await this.getFirstUserMessages(sessionIds);
		const toolTypes = await this.getToolTypesBySessionIds(sessionIds);

		const sessionsWithPrompt: SessionWithPrompt[] = projectSessions.map(
			(s) => ({
				...toSessionData(s),
				firstPrompt: firstPrompts.get(s.id) ?? null,
				toolTypes: toolTypes.get(s.id) ?? [],
			}),
		);

		return {
			sessions: sessionsWithPrompt,
			total: totalResult[0]?.count || 0,
		};
	}

	async getProjectStats(): Promise<OverallStats> {
		const result = await db
			.select({
				totalProjects: sql<number>`count(distinct ${sessions.projectName})`.as(
					"total_projects",
				),
				totalSessions: sql<number>`count(*)`.as("total_sessions"),
				totalInputTokens:
					sql<number>`coalesce(sum(${sessions.inputTokens}), 0)`.as(
						"total_input_tokens",
					),
				totalOutputTokens:
					sql<number>`coalesce(sum(${sessions.outputTokens}), 0)`.as(
						"total_output_tokens",
					),
			})
			.from(sessions);

		const stats = result[0];

		return {
			totalProjects: stats?.totalProjects || 0,
			totalSessions: stats?.totalSessions || 0,
			totalTokens:
				(stats?.totalInputTokens || 0) + (stats?.totalOutputTokens || 0),
		};
	}

	// -------------------------------------------------------------------------
	// Timeline
	// -------------------------------------------------------------------------

	async getTimelineData(
		sessionId: string,
	): Promise<{ messages: MessageData[]; toolCalls: ToolCallData[] } | null> {
		const sessionResult = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1);

		if (sessionResult.length === 0) {
			return null;
		}

		const sessionMessages = await this.getMessagesBySessionId(sessionId);
		const sessionToolCalls = await this.getToolCallsBySessionId(sessionId);

		return {
			messages: sessionMessages,
			toolCalls: sessionToolCalls,
		};
	}

	// -------------------------------------------------------------------------
	// Ingest
	// -------------------------------------------------------------------------

	async ingestSession(
		session: SessionData,
		sessionToolCalls: ToolCallData[],
		sessionMessages: MessageData[],
	): Promise<{ created: boolean }> {
		// Upsert session
		await db
			.insert(sessions)
			.values(session)
			.onConflictDoUpdate({
				target: sessions.id,
				set: {
					endedAt: session.endedAt,
					totalDurationMs: session.totalDurationMs,
					inputTokens: session.inputTokens,
					outputTokens: session.outputTokens,
					cacheReadTokens: session.cacheReadTokens,
					cacheCreationTokens: session.cacheCreationTokens,
					toolCallCount: session.toolCallCount,
					subAgentCount: session.subAgentCount,
					status: session.status,
				},
			});

		// Get existing UUIDs to avoid duplicates
		const existingToolCalls = await db
			.select({ uuid: toolCalls.uuid })
			.from(toolCalls)
			.where(eq(toolCalls.sessionId, session.id));
		const existingToolUuids = new Set(existingToolCalls.map((t) => t.uuid));

		const existingMessages = await db
			.select({ uuid: messages.uuid })
			.from(messages)
			.where(eq(messages.sessionId, session.id));
		const existingMessageUuids = new Set(existingMessages.map((m) => m.uuid));

		// Filter new items
		const newToolCalls = sessionToolCalls.filter(
			(tc) => !existingToolUuids.has(tc.uuid),
		);
		const newMessages = sessionMessages.filter(
			(msg) => !existingMessageUuids.has(msg.uuid),
		);

		// Batch insert new tool calls
		if (newToolCalls.length > 0) {
			await db.insert(toolCalls).values(newToolCalls).onConflictDoNothing();
		}

		// Batch insert new messages
		if (newMessages.length > 0) {
			await db.insert(messages).values(newMessages).onConflictDoNothing();
		}

		return { created: true };
	}
}
