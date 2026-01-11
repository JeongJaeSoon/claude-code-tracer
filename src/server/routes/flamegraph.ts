import { Hono } from "hono";
import { db } from "../db/client.ts";
import { sessions, toolCalls } from "../db/schema.ts";
import { eq } from "drizzle-orm";

export interface FlameChartNode {
	name: string;
	start: number;
	duration: number;
	type?: string;
	color?: string;
	children?: FlameChartNode[];
}

export const flamegraphRoutes = new Hono();

// GET /api/flamegraph/:sessionId - Get flamegraph data for a session
flamegraphRoutes.get("/:sessionId", async (c) => {
	try {
		const sessionId = c.req.param("sessionId");

		const session = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1);

		if (session.length === 0) {
			return c.json({ error: "Session not found" }, 404);
		}

		const tools = await db
			.select()
			.from(toolCalls)
			.where(eq(toolCalls.sessionId, sessionId))
			.orderBy(toolCalls.startTime);

		// Build flamegraph structure
		const flameData = buildFlameGraph(session[0]!, tools);

		return c.json(flameData);
	} catch (error) {
		console.error("Flamegraph fetch error:", error);
		return c.json({ error: String(error) }, 500);
	}
});

function buildFlameGraph(
	session: typeof sessions.$inferSelect,
	tools: (typeof toolCalls.$inferSelect)[],
): FlameChartNode {
	const totalDuration = session.totalDurationMs || 0;

	const root: FlameChartNode = {
		name: `Session: ${session.projectName} (${session.id.slice(0, 8)})`,
		start: 0,
		duration: totalDuration,
		type: "session",
		children: [],
	};

	// Group tools by their parent (uuid -> parentUuid relationship)
	const toolMap = new Map<string, typeof tools>();
	const rootTools: (typeof tools)[0][] = [];

	tools.forEach((tool) => {
		if (!tool.parentUuid) {
			rootTools.push(tool);
		}
	});

	// Build tree recursively
	const buildChildren = (parentUuid: string | null): FlameChartNode[] => {
		const children: FlameChartNode[] = [];
		const childTools = tools.filter((t) => t.parentUuid === parentUuid);

		for (const tool of childTools) {
			const node: FlameChartNode = {
				name: formatToolName(tool.toolName, tool.toolInput),
				start: tool.startTime,
				duration: tool.durationMs || 0,
				type: tool.toolName.toLowerCase(),
				color: getToolColor(tool.toolName),
				children: buildChildren(tool.uuid),
			};
			children.push(node);
		}

		return children;
	};

	// Start building from root level tools
	for (const tool of rootTools) {
		const node: FlameChartNode = {
			name: formatToolName(tool.toolName, tool.toolInput),
			start: tool.startTime,
			duration: tool.durationMs || 0,
			type: tool.toolName.toLowerCase(),
			color: getToolColor(tool.toolName),
			children: buildChildren(tool.uuid),
		};
		root.children!.push(node);
	}

	return root;
}

function formatToolName(name: string, input: string | null): string {
	if (!input) return name;

	try {
		const parsed = JSON.parse(input);
		if (parsed.command) {
			return `${name}: ${truncate(parsed.command, 30)}`;
		}
		if (parsed.file_path) {
			return `${name}: ${truncate(parsed.file_path.split("/").pop() || "", 30)}`;
		}
		if (parsed.pattern) {
			return `${name}: ${truncate(parsed.pattern, 30)}`;
		}
		if (parsed.description) {
			return `${name}: ${truncate(parsed.description, 30)}`;
		}
	} catch {
		// ignore parse errors
	}

	return name;
}

function truncate(str: string, len: number): string {
	return str.length > len ? str.slice(0, len) + "..." : str;
}

function getToolColor(toolName: string): string {
	const colors: Record<string, string> = {
		Bash: "#10b981",
		Read: "#3b82f6",
		Edit: "#f59e0b",
		Write: "#8b5cf6",
		Grep: "#ec4899",
		Glob: "#06b6d4",
		Task: "#f97316",
		WebFetch: "#6366f1",
		WebSearch: "#6366f1",
		TodoWrite: "#a855f7",
	};

	return colors[toolName] || "#64748b";
}
