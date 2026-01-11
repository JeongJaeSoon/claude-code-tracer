import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Sessions table
export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	projectDir: text("project_dir").notNull(),
	projectName: text("project_name").notNull(),
	gitBranch: text("git_branch"),
	model: text("model"),
	version: text("version"),
	startedAt: text("started_at").notNull(),
	endedAt: text("ended_at"),
	totalDurationMs: integer("total_duration_ms"),
	inputTokens: integer("input_tokens").default(0),
	outputTokens: integer("output_tokens").default(0),
	cacheReadTokens: integer("cache_read_tokens").default(0),
	cacheCreationTokens: integer("cache_creation_tokens").default(0),
	toolCallCount: integer("tool_call_count").default(0),
	subAgentCount: integer("sub_agent_count").default(0),
	status: text("status", { enum: ["running", "completed", "error"] }).default(
		"running",
	),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Tool calls table
export const toolCalls = sqliteTable("tool_calls", {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),
	parentId: text("parent_id"),
	uuid: text("uuid").notNull(),
	parentUuid: text("parent_uuid"),
	agentId: text("agent_id"),
	toolName: text("tool_name").notNull(),
	toolInput: text("tool_input"), // JSON string
	toolOutput: text("tool_output"), // truncated result content
	durationMs: integer("duration_ms"),
	startTime: real("start_time").notNull(), // relative to session start (ms)
	isError: integer("is_error", { mode: "boolean" }).default(false),
	errorMessage: text("error_message"),
	timestamp: text("timestamp").notNull(),
});

// Messages table (for timeline)
export const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),
	uuid: text("uuid").notNull(),
	parentUuid: text("parent_uuid"),
	type: text("type", { enum: ["user", "assistant", "summary"] }).notNull(),
	agentId: text("agent_id"),
	isSidechain: integer("is_sidechain", { mode: "boolean" }).default(false),
	content: text("content"), // truncated text content for display
	thinking: text("thinking"), // truncated thinking content for display
	timestamp: text("timestamp").notNull(),
});

// Types
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
