// Repository 패턴을 위한 타입 정의
// Drizzle 스키마와 독립적으로 정의하여 MemoryRepository에서도 사용 가능

// ============================================================================
// 데이터 타입 (Drizzle-independent)
// ============================================================================

export interface SessionData {
	id: string;
	projectDir: string;
	projectName: string;
	gitBranch: string | null;
	model: string | null;
	version: string | null;
	startedAt: string;
	endedAt: string | null;
	totalDurationMs: number | null;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	toolCallCount: number;
	subAgentCount: number;
	status: "running" | "completed" | "error";
	createdAt: string;
}

export interface ToolCallData {
	id: string;
	sessionId: string;
	parentId: string | null;
	uuid: string;
	parentUuid: string | null;
	agentId: string | null;
	toolName: string;
	toolInput: string | null;
	toolOutput: string | null;
	durationMs: number | null;
	startTime: number;
	isError: boolean;
	errorMessage: string | null;
	timestamp: string;
}

export interface MessageData {
	id: string;
	sessionId: string;
	uuid: string;
	parentUuid: string | null;
	type: "user" | "assistant" | "summary";
	agentId: string | null;
	isSidechain: boolean;
	content: string | null;
	thinking: string | null;
	timestamp: string;
}

// ============================================================================
// Scanner 결과 타입 (MemoryRepository에서 사용)
// ============================================================================

export interface ScanResult {
	sessions: SessionData[];
	toolCalls: ToolCallData[];
	messages: MessageData[];
}

// ============================================================================
// 쿼리 옵션 타입
// ============================================================================

export interface SessionQueryOptions {
	limit: number;
	offset: number;
	search?: string;
	status?: string;
	dateRange?: string;
	tool?: string;
	duration?: string;
	minTokens?: string;
	maxTokens?: string;
}

export interface ProjectQueryOptions {
	limit: number;
	offset: number;
	search?: string;
}

// ============================================================================
// 통계 타입
// ============================================================================

export interface SessionStats {
	totalSessions: number;
	totalTokens: {
		input: number;
		output: number;
		cacheRead: number;
	};
	totalToolCalls: number;
	avgDurationMs: number;
}

export interface ProjectStats {
	projectName: string;
	projectDir: string;
	sessionCount: number;
	lastSessionAt: string;
	totalTokens: number;
	totalToolCalls: number;
}

export interface OverallStats {
	totalProjects: number;
	totalSessions: number;
	totalTokens: number;
}

// ============================================================================
// 응답 타입
// ============================================================================

/** 세션 목록 조회 시 반환되는 세션 (첫 프롬프트 + 도구 타입 포함) */
export interface SessionWithPrompt extends SessionData {
	firstPrompt: string | null;
	toolTypes: string[];
}

/** 세션 상세 조회 시 반환되는 세션 (toolCalls, messages 포함) */
export interface SessionDetail extends SessionData {
	toolCalls: ToolCallData[];
	messages: MessageData[];
}

// ============================================================================
// Repository 인터페이스
// ============================================================================

export interface IRepository {
	// -------------------------------------------------------------------------
	// Sessions
	// -------------------------------------------------------------------------

	/** 세션 목록 조회 (필터링, 페이지네이션 지원) */
	getSessions(
		options: SessionQueryOptions,
	): Promise<{ sessions: SessionWithPrompt[]; total: number }>;

	/** 세션 상세 조회 (toolCalls, messages 포함) */
	getSessionById(id: string): Promise<SessionDetail | null>;

	/** 세션 통계 조회 */
	getSessionStats(): Promise<SessionStats>;

	/** 세션 삭제 (Server mode only) */
	deleteSession?(id: string): Promise<void>;

	// -------------------------------------------------------------------------
	// ToolCalls
	// -------------------------------------------------------------------------

	/** 세션의 도구 호출 목록 조회 */
	getToolCallsBySessionId(sessionId: string): Promise<ToolCallData[]>;

	/** 특정 도구를 사용한 세션 ID 목록 조회 */
	getSessionIdsWithTool(toolName: string): Promise<string[]>;

	/** 세션별 사용된 도구 타입 목록 조회 */
	getToolTypesBySessionIds(
		sessionIds: string[],
	): Promise<Map<string, string[]>>;

	// -------------------------------------------------------------------------
	// Messages
	// -------------------------------------------------------------------------

	/** 세션의 메시지 목록 조회 */
	getMessagesBySessionId(sessionId: string): Promise<MessageData[]>;

	/** 세션별 첫 사용자 메시지 조회 */
	getFirstUserMessages(
		sessionIds: string[],
	): Promise<Map<string, string | null>>;

	// -------------------------------------------------------------------------
	// Projects
	// -------------------------------------------------------------------------

	/** 프로젝트 목록 조회 (통계 포함) */
	getProjects(
		options: ProjectQueryOptions,
	): Promise<{ projects: ProjectStats[]; total: number }>;

	/** 프로젝트의 세션 목록 조회 */
	getProjectSessions(
		projectName: string,
		options: { limit: number; offset: number },
	): Promise<{ sessions: SessionWithPrompt[]; total: number }>;

	/** 전체 프로젝트 통계 조회 */
	getProjectStats(): Promise<OverallStats>;

	// -------------------------------------------------------------------------
	// Timeline
	// -------------------------------------------------------------------------

	/** 타임라인 데이터 조회 */
	getTimelineData(
		sessionId: string,
	): Promise<{ messages: MessageData[]; toolCalls: ToolCallData[] } | null>;

	// -------------------------------------------------------------------------
	// Ingest (Server mode only)
	// -------------------------------------------------------------------------

	/** 세션 데이터 수집 (Server mode only) */
	ingestSession?(
		session: SessionData,
		toolCalls: ToolCallData[],
		messages: MessageData[],
	): Promise<{ created: boolean }>;
}
