// Claude Code 공식 도구 목록 (used internally by getToolIcon)
const TOOL_ICONS: Record<string, string> = {
	// 파일 작업
	read: "R",
	write: "W",
	edit: "E",
	glob: "G",
	grep: "S",
	notebookedit: "N",
	// 실행
	bash: "$",
	task: "T",
	taskoutput: "O",
	killshell: "K",
	// 웹
	webfetch: "F",
	websearch: "🔍",
	// 상호작용
	askuserquestion: "?",
	todowrite: "✓",
	skill: "/",
	mcpsearch: "M",
	// 플래닝
	enterplanmode: "P",
	exitplanmode: "P",
};

export const TOOL_COLORS: Record<string, string> = {
	// 파일 작업 - 녹색/청록/블루 계열
	read: "#10b981",
	write: "#f472b6",
	edit: "#3b82f6",
	glob: "#06b6d4",
	grep: "#eab308",
	notebookedit: "#fb923c",
	// 실행 - 주황/분홍 계열
	bash: "#f97316",
	task: "#ec4899",
	taskoutput: "#f472b6",
	killshell: "#ef4444",
	// 웹 - 시안 계열
	webfetch: "#22d3ee",
	websearch: "#67e8f9",
	// 상호작용 - 다양한 색상
	askuserquestion: "#f43f5e",
	todowrite: "#14b8a6",
	skill: "#f59e0b",
	mcpsearch: "#fb7185",
	// 플래닝 - 하늘색 계열
	enterplanmode: "#0ea5e9",
	exitplanmode: "#38bdf8",
};

export function getToolIcon(toolName: string): string {
	return TOOL_ICONS[toolName.toLowerCase()] || toolName.charAt(0).toUpperCase();
}

export function getToolColor(toolName: string): string {
	return TOOL_COLORS[toolName.toLowerCase()] || "#64748b";
}
