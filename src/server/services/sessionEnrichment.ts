import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { messages, toolCalls } from "../db/schema.ts";

/**
 * Enrichment data for sessions including first prompt and tool types
 */
export interface SessionEnrichment {
	firstPrompts: Record<string, string>;
	toolTypes: Record<string, string[]>;
}

/**
 * Fetch first user prompts for given session IDs
 */
async function getFirstPromptsBySession(
	sessionIds: string[],
): Promise<Record<string, string>> {
	if (sessionIds.length === 0) {
		return {};
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

	const firstPrompts: Record<string, string> = {};
	for (const msg of firstMessages) {
		if (!firstPrompts[msg.sessionId] && msg.content) {
			firstPrompts[msg.sessionId] = msg.content;
		}
	}

	return firstPrompts;
}

/**
 * Fetch tool types used in each session
 */
async function getToolTypesBySession(
	sessionIds: string[],
): Promise<Record<string, string[]>> {
	if (sessionIds.length === 0) {
		return {};
	}

	const toolTypesResult = await db
		.select({
			sessionId: toolCalls.sessionId,
			toolName: toolCalls.toolName,
		})
		.from(toolCalls)
		.where(inArray(toolCalls.sessionId, sessionIds))
		.groupBy(toolCalls.sessionId, toolCalls.toolName);

	const sessionToolTypes: Record<string, string[]> = {};
	for (const row of toolTypesResult) {
		const existing = sessionToolTypes[row.sessionId];
		if (!existing) {
			sessionToolTypes[row.sessionId] = [row.toolName];
		} else if (!existing.includes(row.toolName)) {
			existing.push(row.toolName);
		}
	}

	return sessionToolTypes;
}

/**
 * Fetch all enrichment data for sessions (first prompts and tool types)
 */
export async function enrichSessions(
	sessionIds: string[],
): Promise<SessionEnrichment> {
	const [firstPrompts, toolTypes] = await Promise.all([
		getFirstPromptsBySession(sessionIds),
		getToolTypesBySession(sessionIds),
	]);

	return { firstPrompts, toolTypes };
}
