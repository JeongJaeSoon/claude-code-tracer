import { readdir, stat } from "node:fs/promises";
import type {
	MessageData,
	ScanResult,
	SessionData,
	ToolCallData,
} from "../repositories/types.ts";
import { parseJSONL } from "./parser.ts";

/**
 * ~/.claude/projects 디렉토리를 스캔하여 모든 세션 데이터를 로드합니다.
 * Local mode에서 사용됩니다.
 */
export async function scanClaudeDirectory(
	basePath: string = `${process.env.HOME}/.claude`,
): Promise<ScanResult> {
	const result: ScanResult = { sessions: [], toolCalls: [], messages: [] };
	const projectsDir = `${basePath}/projects`;

	try {
		const projectFolders = await readdir(projectsDir);

		for (const projectFolder of projectFolders) {
			const projectPath = `${projectsDir}/${projectFolder}`;

			// Skip if not a directory
			try {
				const projectStat = await stat(projectPath);
				if (!projectStat.isDirectory()) continue;
			} catch {
				continue;
			}

			const files = await readdir(projectPath);

			for (const file of files) {
				if (!file.endsWith(".jsonl")) continue;

				const sessionId = file.replace(".jsonl", "");
				const filePath = `${projectPath}/${file}`;

				try {
					// Parse main session file
					const content = await Bun.file(filePath).text();
					const parsed = await parseJSONL(content);

					if (!parsed.session) continue;

					// Check for subagents directory
					const subagentsDir = `${projectPath}/${sessionId}/subagents`;
					let subAgentCount = 0;

					try {
						const subagentFiles = await readdir(subagentsDir);
						for (const subFile of subagentFiles) {
							if (!subFile.endsWith(".jsonl")) continue;

							const subContent = await Bun.file(
								`${subagentsDir}/${subFile}`,
							).text();
							const subParsed = await parseJSONL(subContent);

							// Merge subagent data
							if (subParsed.toolCalls.length > 0) {
								parsed.toolCalls.push(...subParsed.toolCalls);
							}
							if (subParsed.messages.length > 0) {
								parsed.messages.push(...subParsed.messages);
							}

							// Accumulate tokens
							if (subParsed.session) {
								parsed.session.inputTokens =
									(parsed.session.inputTokens || 0) +
									(subParsed.session.inputTokens || 0);
								parsed.session.outputTokens =
									(parsed.session.outputTokens || 0) +
									(subParsed.session.outputTokens || 0);
								parsed.session.cacheReadTokens =
									(parsed.session.cacheReadTokens || 0) +
									(subParsed.session.cacheReadTokens || 0);
							}

							subAgentCount++;
						}
					} catch {
						// No subagents directory - that's fine
					}

					// Update counts
					parsed.session.toolCallCount = parsed.toolCalls.length;
					parsed.session.subAgentCount = subAgentCount;

					// Convert to SessionData type
					const sessionData: SessionData = {
						id: parsed.session.id,
						projectDir: parsed.session.projectDir,
						projectName: parsed.session.projectName,
						gitBranch: parsed.session.gitBranch ?? null,
						model: parsed.session.model ?? null,
						version: parsed.session.version ?? null,
						startedAt: parsed.session.startedAt,
						endedAt: parsed.session.endedAt ?? null,
						totalDurationMs: parsed.session.totalDurationMs ?? null,
						inputTokens: parsed.session.inputTokens ?? 0,
						outputTokens: parsed.session.outputTokens ?? 0,
						cacheReadTokens: parsed.session.cacheReadTokens ?? 0,
						cacheCreationTokens: parsed.session.cacheCreationTokens ?? 0,
						toolCallCount: parsed.session.toolCallCount ?? 0,
						subAgentCount: parsed.session.subAgentCount ?? 0,
						status: parsed.session.status ?? "completed",
						createdAt: parsed.session.createdAt,
					};

					result.sessions.push(sessionData);

					// Convert tool calls
					for (const tc of parsed.toolCalls) {
						const toolCallData: ToolCallData = {
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
						result.toolCalls.push(toolCallData);
					}

					// Convert messages
					for (const msg of parsed.messages) {
						const messageData: MessageData = {
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
						};
						result.messages.push(messageData);
					}
				} catch (err) {
					console.error(`Failed to parse ${filePath}:`, err);
				}
			}
		}
	} catch (err) {
		console.error(`Failed to scan ${projectsDir}:`, err);
	}

	console.log(`Scanned ${result.sessions.length} sessions`);
	return result;
}
