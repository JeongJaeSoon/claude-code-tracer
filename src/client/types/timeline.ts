export interface PromptBlock {
	id: string;
	content: string;
	startTime: number;
	timestamp: string;
}

export interface AssistantMessage {
	id: string;
	content: string;
	timestamp: string;
}

export interface TurnStep {
	id: string;
	type: "thinking" | "assistant_text" | "tool";
	content: string;
	timestamp: string;
	startTime: number;
	// tool-specific fields
	toolName?: string;
	toolInput?: string;
	toolOutput?: string;
	toolDuration?: number;
	isError?: boolean;
}

export interface Turn {
	id: string;
	userPrompt: PromptBlock;
	steps: TurnStep[];
	finalResponse: AssistantMessage | null;
	startTime: number;
	endTime: number;
	toolCount: number;
}

export interface TimelineLane {
	id: string;
	name: string;
	color: string;
	turns: Turn[];
}

export interface TimelineData {
	session: {
		id: string;
		projectName: string;
		startedAt: string;
		endedAt: string | null;
		totalDurationMs: number | null;
	};
	lanes: TimelineLane[];
}

export interface Session {
	id: string;
	projectName: string;
	projectDir: string;
	model: string | null;
	startedAt: string;
	endedAt: string | null;
	totalDurationMs: number | null;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	toolCallCount: number;
	subAgentCount: number;
	status: "running" | "completed" | "error";
	toolTypes?: string[];
	firstPrompt?: string | null;
}
