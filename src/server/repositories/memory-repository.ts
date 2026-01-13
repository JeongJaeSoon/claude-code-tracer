import {
	getDateThresholdAsDate,
	getDurationRange,
} from "../utils/dateFilters.ts";
import type {
	IRepository,
	MessageData,
	OverallStats,
	ProjectQueryOptions,
	ProjectStats,
	ScanResult,
	SessionData,
	SessionDetail,
	SessionQueryOptions,
	SessionStats,
	SessionWithPrompt,
	ToolCallData,
} from "./types.ts";

/**
 * 메모리 기반 Repository 구현
 * Local mode에서 사용되며, Scanner로 로드한 데이터를 메모리에 저장합니다.
 * 읽기 전용이며, ingest/delete 작업은 지원하지 않습니다.
 */
export class MemoryRepository implements IRepository {
	private sessions = new Map<string, SessionData>();
	private toolCallsBySession = new Map<string, ToolCallData[]>();
	private messagesBySession = new Map<string, MessageData[]>();

	/**
	 * Scanner 결과를 메모리에 로드합니다.
	 */
	load(data: ScanResult): void {
		// Load sessions
		for (const session of data.sessions) {
			this.sessions.set(session.id, session);
		}

		// Load tool calls (grouped by session)
		for (const toolCall of data.toolCalls) {
			const existing = this.toolCallsBySession.get(toolCall.sessionId) || [];
			existing.push(toolCall);
			this.toolCallsBySession.set(toolCall.sessionId, existing);
		}

		// Load messages (grouped by session)
		for (const message of data.messages) {
			const existing = this.messagesBySession.get(message.sessionId) || [];
			existing.push(message);
			this.messagesBySession.set(message.sessionId, existing);
		}

		// Sort tool calls by startTime
		for (const [sessionId, tcs] of this.toolCallsBySession) {
			tcs.sort((a, b) => a.startTime - b.startTime);
			this.toolCallsBySession.set(sessionId, tcs);
		}

		// Sort messages by timestamp
		for (const [sessionId, msgs] of this.messagesBySession) {
			msgs.sort(
				(a, b) =>
					new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
			);
			this.messagesBySession.set(sessionId, msgs);
		}
	}

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

		let result = Array.from(this.sessions.values());

		// Filter by search
		if (search) {
			const searchLower = search.toLowerCase();
			result = result.filter(
				(s) =>
					s.id.toLowerCase().includes(searchLower) ||
					s.projectName.toLowerCase().includes(searchLower),
			);
		}

		// Filter by status
		if (status && status !== "all") {
			result = result.filter((s) => s.status === status);
		}

		// Filter by date range
		const dateThreshold = getDateThresholdAsDate(dateRange || "");
		if (dateThreshold) {
			result = result.filter((s) => new Date(s.startedAt) >= dateThreshold);
		}

		// Filter by duration
		const durationRange = getDurationRange(duration || "");
		if (durationRange) {
			result = result.filter(
				(s) =>
					s.totalDurationMs !== null &&
					s.totalDurationMs >= durationRange.min &&
					s.totalDurationMs <= durationRange.max,
			);
		}

		// Filter by tokens
		if (minTokens) {
			const minVal = Number(minTokens);
			if (!Number.isNaN(minVal)) {
				result = result.filter((s) => s.inputTokens + s.outputTokens >= minVal);
			}
		}
		if (maxTokens) {
			const maxVal = Number(maxTokens);
			if (!Number.isNaN(maxVal)) {
				result = result.filter((s) => s.inputTokens + s.outputTokens <= maxVal);
			}
		}

		// Filter by tool
		if (tool) {
			const sessionIdsWithTool = await this.getSessionIdsWithTool(tool);
			const toolSessionSet = new Set(sessionIdsWithTool);
			result = result.filter((s) => toolSessionSet.has(s.id));
		}

		// Sort by startedAt descending
		result.sort(
			(a, b) =>
				new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
		);

		const total = result.length;

		// Pagination
		result = result.slice(offset, offset + limit);

		// Get first prompts and tool types
		const sessionIds = result.map((s) => s.id);
		const firstPrompts = await this.getFirstUserMessages(sessionIds);
		const toolTypes = await this.getToolTypesBySessionIds(sessionIds);

		const sessionsWithPrompt: SessionWithPrompt[] = result.map((s) => ({
			...s,
			firstPrompt: firstPrompts.get(s.id) ?? null,
			toolTypes: toolTypes.get(s.id) ?? [],
		}));

		return { sessions: sessionsWithPrompt, total };
	}

	async getSessionById(id: string): Promise<SessionDetail | null> {
		const session = this.sessions.get(id);
		if (!session) {
			return null;
		}

		const sessionToolCalls = this.toolCallsBySession.get(id) || [];
		const sessionMessages = this.messagesBySession.get(id) || [];

		return {
			...session,
			toolCalls: sessionToolCalls,
			messages: sessionMessages,
		};
	}

	async getSessionStats(): Promise<SessionStats> {
		const allSessions = Array.from(this.sessions.values());
		let totalToolCalls = 0;

		for (const tcs of this.toolCallsBySession.values()) {
			totalToolCalls += tcs.length;
		}

		const totalInput = allSessions.reduce((sum, s) => sum + s.inputTokens, 0);
		const totalOutput = allSessions.reduce((sum, s) => sum + s.outputTokens, 0);
		const totalCacheRead = allSessions.reduce(
			(sum, s) => sum + s.cacheReadTokens,
			0,
		);

		const durationsMs = allSessions
			.map((s) => s.totalDurationMs)
			.filter((d): d is number => d !== null);
		const avgDurationMs =
			durationsMs.length > 0
				? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
				: 0;

		return {
			totalSessions: allSessions.length,
			totalTokens: {
				input: totalInput,
				output: totalOutput,
				cacheRead: totalCacheRead,
			},
			totalToolCalls,
			avgDurationMs: Math.round(avgDurationMs),
		};
	}

	// -------------------------------------------------------------------------
	// ToolCalls
	// -------------------------------------------------------------------------

	async getToolCallsBySessionId(sessionId: string): Promise<ToolCallData[]> {
		return this.toolCallsBySession.get(sessionId) || [];
	}

	async getSessionIdsWithTool(toolName: string): Promise<string[]> {
		const sessionIds: string[] = [];

		for (const [sessionId, tcs] of this.toolCallsBySession) {
			if (tcs.some((tc) => tc.toolName === toolName)) {
				sessionIds.push(sessionId);
			}
		}

		return sessionIds;
	}

	async getToolTypesBySessionIds(
		sessionIds: string[],
	): Promise<Map<string, string[]>> {
		const result = new Map<string, string[]>();

		for (const sessionId of sessionIds) {
			const tcs = this.toolCallsBySession.get(sessionId) || [];
			const toolNames = [...new Set(tcs.map((tc) => tc.toolName))];
			result.set(sessionId, toolNames);
		}

		return result;
	}

	// -------------------------------------------------------------------------
	// Messages
	// -------------------------------------------------------------------------

	async getMessagesBySessionId(sessionId: string): Promise<MessageData[]> {
		return this.messagesBySession.get(sessionId) || [];
	}

	async getFirstUserMessages(
		sessionIds: string[],
	): Promise<Map<string, string | null>> {
		const result = new Map<string, string | null>();

		for (const sessionId of sessionIds) {
			const msgs = this.messagesBySession.get(sessionId) || [];
			const firstUserMsg = msgs.find(
				(m) =>
					m.type === "user" &&
					(!m.parentUuid || m.parentUuid === "") &&
					m.content !== "Warmup",
			);
			result.set(sessionId, firstUserMsg?.content ?? null);
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

		const projectMap = new Map<
			string,
			{
				projectDir: string;
				sessions: SessionData[];
			}
		>();

		for (const session of this.sessions.values()) {
			const existing = projectMap.get(session.projectName);
			if (existing) {
				existing.sessions.push(session);
			} else {
				projectMap.set(session.projectName, {
					projectDir: session.projectDir,
					sessions: [session],
				});
			}
		}

		const projects: ProjectStats[] = [];

		for (const [projectName, data] of projectMap) {
			if (search && !projectName.toLowerCase().includes(search.toLowerCase())) {
				continue;
			}

			const totalTokens = data.sessions.reduce(
				(sum, s) => sum + s.inputTokens + s.outputTokens,
				0,
			);
			const totalToolCalls = data.sessions.reduce(
				(sum, s) => sum + s.toolCallCount,
				0,
			);
			const lastSession = data.sessions.sort(
				(a, b) =>
					new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
			)[0];

			projects.push({
				projectName,
				projectDir: data.projectDir,
				sessionCount: data.sessions.length,
				lastSessionAt: lastSession?.startedAt || "",
				totalTokens,
				totalToolCalls,
			});
		}

		// Sort by last session
		projects.sort(
			(a, b) =>
				new Date(b.lastSessionAt).getTime() -
				new Date(a.lastSessionAt).getTime(),
		);

		return { projects, total: projects.length };
	}

	async getProjectSessions(
		projectName: string,
		options: { limit: number; offset: number },
	): Promise<{ sessions: SessionWithPrompt[]; total: number }> {
		const { limit, offset } = options;

		let projectSessions = Array.from(this.sessions.values()).filter(
			(s) => s.projectName === projectName,
		);

		// Sort by startedAt descending
		projectSessions.sort(
			(a, b) =>
				new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
		);

		const total = projectSessions.length;

		// Pagination
		projectSessions = projectSessions.slice(offset, offset + limit);

		// Get first prompts and tool types
		const sessionIds = projectSessions.map((s) => s.id);
		const firstPrompts = await this.getFirstUserMessages(sessionIds);
		const toolTypes = await this.getToolTypesBySessionIds(sessionIds);

		const sessionsWithPrompt: SessionWithPrompt[] = projectSessions.map(
			(s) => ({
				...s,
				firstPrompt: firstPrompts.get(s.id) ?? null,
				toolTypes: toolTypes.get(s.id) ?? [],
			}),
		);

		return { sessions: sessionsWithPrompt, total };
	}

	async getProjectStats(): Promise<OverallStats> {
		const allSessions = Array.from(this.sessions.values());
		const projectNames = new Set(allSessions.map((s) => s.projectName));

		const totalTokens = allSessions.reduce(
			(sum, s) => sum + s.inputTokens + s.outputTokens,
			0,
		);

		return {
			totalProjects: projectNames.size,
			totalSessions: allSessions.length,
			totalTokens,
		};
	}

	// -------------------------------------------------------------------------
	// Timeline
	// -------------------------------------------------------------------------

	async getTimelineData(
		sessionId: string,
	): Promise<{ messages: MessageData[]; toolCalls: ToolCallData[] } | null> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return null;
		}

		const sessionMessages = this.messagesBySession.get(sessionId) || [];
		const sessionToolCalls = this.toolCallsBySession.get(sessionId) || [];

		return {
			messages: sessionMessages,
			toolCalls: sessionToolCalls,
		};
	}

	// -------------------------------------------------------------------------
	// Not supported in local mode
	// -------------------------------------------------------------------------

	async ingestSession(): Promise<{ created: boolean }> {
		throw new Error("Ingest not supported in local mode");
	}

	async deleteSession(): Promise<void> {
		throw new Error("Delete not supported in local mode");
	}
}
