export const TOOL_ICONS: Record<string, string> = {
  glob: "G",
  read: "R",
  edit: "E",
  write: "W",
  bash: "$",
  grep: "S",
  task: "T",
  webfetch: "F",
  websearch: "W",
  todowrite: "L",
  mcpsearch: "M",
  askuserquestion: "?",
};

export const TOOL_COLORS: Record<string, string> = {
  glob: "#06b6d4",
  read: "#10b981",
  edit: "#3b82f6",
  write: "#a855f7",
  bash: "#f97316",
  grep: "#eab308",
  task: "#ec4899",
  webfetch: "#6366f1",
  websearch: "#6366f1",
  todowrite: "#14b8a6",
  mcpsearch: "#a855f7",
  askuserquestion: "#f43f5e",
};

export function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName.toLowerCase()] || toolName.charAt(0).toUpperCase();
}

export function getToolColor(toolName: string): string {
  return TOOL_COLORS[toolName.toLowerCase()] || "#64748b";
}
