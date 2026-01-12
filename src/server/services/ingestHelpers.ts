import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import {
	messages,
	type NewMessage,
	type NewSession,
	type NewToolCall,
	sessions,
	toolCalls,
} from "../db/schema.ts";

/**
 * Upsert session data (insert or update on conflict)
 */
export async function upsertSession(session: NewSession): Promise<void> {
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
}

/**
 * Insert new items filtering out duplicates based on existing UUIDs
 */
export async function insertNewItems(
	sessionId: string,
	newToolCalls: NewToolCall[],
	newMessages: NewMessage[],
): Promise<{ toolCallCount: number; messageCount: number }> {
	// Get existing UUIDs to prevent duplicates
	const existingToolCalls = await db
		.select({ uuid: toolCalls.uuid })
		.from(toolCalls)
		.where(eq(toolCalls.sessionId, sessionId));
	const existingToolUuids = new Set(existingToolCalls.map((t) => t.uuid));

	const existingMessagesList = await db
		.select({ uuid: messages.uuid })
		.from(messages)
		.where(eq(messages.sessionId, sessionId));
	const existingMessageUuids = new Set(existingMessagesList.map((m) => m.uuid));

	// Filter to only new items
	const filteredToolCalls = newToolCalls.filter(
		(tc) => !existingToolUuids.has(tc.uuid),
	);
	const filteredMessages = newMessages.filter(
		(msg) => !existingMessageUuids.has(msg.uuid),
	);

	// Insert new tool calls
	for (const toolCall of filteredToolCalls) {
		await db.insert(toolCalls).values(toolCall).onConflictDoNothing();
	}

	// Insert new messages
	for (const message of filteredMessages) {
		await db.insert(messages).values(message).onConflictDoNothing();
	}

	return {
		toolCallCount: filteredToolCalls.length,
		messageCount: filteredMessages.length,
	};
}
