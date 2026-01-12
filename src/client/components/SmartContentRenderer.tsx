import { useMemo } from "react";
import { CopyButton } from "./CopyButton.tsx";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import { SyntaxHighlighter, vscDarkPlus } from "./syntaxHighlighter.ts";

type ContentType = "json" | "markdown" | "code" | "cli" | "plain";

interface SmartContentRendererProps {
	content: string;
	className?: string;
	forceType?: ContentType;
	language?: string;
}

const MARKDOWN_PATTERNS = [
	/^#{1,6}\s/m,
	/^```[\s\S]*```$/m,
	/^\s*[-*+]\s/m,
	/^\s*\d+\.\s/m,
	/\[.+\]\(.+\)/,
	/\*\*.+\*\*/,
	/\*.+\*/,
	/^\s*>\s/m,
	/\|.+\|.+\|/,
	/^---$/m,
];

const CLI_PATTERNS = [
	// Shell prompts
	/^\s*\$\s/m,
	/^\s*>\s/m,
	// Unix paths
	/^(\/[\w\-.]+)+/m,
	/^~\//m,
	// Windows paths
	/^[A-Z]:\\[\w\\]+/m,
	// Common CLI commands
	/^\s*(ls|cat|head|tail|grep|find|cd|mkdir|rm|cp|mv|chmod|chown|echo|pwd|curl|wget)\s/m,
	/^\s*(npm|yarn|bun|pnpm|git|docker|kubectl|make|cargo|go|python|node)\s/m,
	// Pipe and redirect
	/\s\|\s/,
	/\s[<>]{1,2}\s/,
	// Log prefixes
	/^(error|warning|info|debug|fatal):/im,
	// ANSI color codes
	/\x1b\[[\d;]*m/,
	// Timestamps
	/^\d{4}-\d{2}-\d{2}/m,
	// File listing (ls -la output)
	/^[-dlrwx]{10}/m,
	/^total\s+\d+/m,
	// Common output patterns
	/^[\w\-.]+\s+\d+\s+[\w-]+\s+[\w-]+\s+\d+/m,
];

function detectContentType(content: string): ContentType {
	if (!content || typeof content !== "string") return "plain";

	const trimmed = content.trim();

	// Check for valid JSON
	if (
		(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
		(trimmed.startsWith("[") && trimmed.endsWith("]"))
	) {
		try {
			JSON.parse(trimmed);
			return "json";
		} catch {
			// Check for JSONL (JSON Lines) - multiple JSON objects concatenated
			if (trimmed.startsWith("{") && trimmed.includes("}{")) {
				return "json";
			}
		}
	}

	const markdownScore = MARKDOWN_PATTERNS.filter((p) => p.test(trimmed)).length;
	if (markdownScore >= 2) return "markdown";

	const cliScore = CLI_PATTERNS.filter((p) => p.test(trimmed)).length;
	if (cliScore >= 1) return "cli";

	const hasCodePatterns =
		trimmed.includes("function ") ||
		trimmed.includes("const ") ||
		trimmed.includes("class ") ||
		trimmed.includes("import ") ||
		/^\s{2,}/m.test(trimmed);

	if (hasCodePatterns) return "code";

	return "plain";
}

function formatJson(content: string): string {
	const trimmed = content.trim();

	// Try parsing as regular JSON first
	try {
		const parsed = JSON.parse(trimmed);
		return JSON.stringify(parsed, null, 2);
	} catch {
		// Try formatting as JSONL (JSON Lines)
		if (trimmed.startsWith("{") && trimmed.includes("}{")) {
			try {
				const lines = trimmed.split(/(?<=\})(?=\{)/);
				return lines
					.map((line) => {
						try {
							const parsed = JSON.parse(line);
							return JSON.stringify(parsed, null, 2);
						} catch {
							return line;
						}
					})
					.join("\n\n");
			} catch {
				return content;
			}
		}
		return content;
	}
}

const HIGHLIGHTER_STYLE: React.CSSProperties = {
	margin: 0,
	borderRadius: "0 0 6px 6px",
	fontSize: "12px",
	lineHeight: "1.5",
	padding: "12px 16px",
	background: "#1a1d23",
};

function renderContentBody(
	contentType: ContentType,
	content: string,
	formattedContent: string,
	language?: string,
): React.ReactElement {
	switch (contentType) {
		case "json":
			return (
				<SyntaxHighlighter
					style={vscDarkPlus}
					language="json"
					customStyle={HIGHLIGHTER_STYLE}
				>
					{formattedContent}
				</SyntaxHighlighter>
			);
		case "markdown":
			return (
				<div className="smart-markdown-wrapper">
					<MarkdownRenderer content={content} />
				</div>
			);
		case "code":
			return (
				<SyntaxHighlighter
					style={vscDarkPlus}
					language={language || "typescript"}
					customStyle={HIGHLIGHTER_STYLE}
				>
					{content}
				</SyntaxHighlighter>
			);
		case "cli":
			return (
				<SyntaxHighlighter
					style={vscDarkPlus}
					language="bash"
					customStyle={HIGHLIGHTER_STYLE}
				>
					{content}
				</SyntaxHighlighter>
			);
		default:
			return <div className="smart-plain-text">{content}</div>;
	}
}

export function SmartContentRenderer({
	content,
	className = "",
	forceType,
	language,
}: SmartContentRendererProps): React.ReactElement {
	const contentType = forceType || detectContentType(content);

	const formattedContent = useMemo(() => {
		return contentType === "json" ? formatJson(content) : content;
	}, [content, contentType]);

	return (
		<div className={`smart-content ${className}`}>
			<div className="smart-content-header">
				<span className="content-type-badge">{contentType.toUpperCase()}</span>
				<CopyButton content={content} />
			</div>
			<div className="smart-content-body">
				{renderContentBody(contentType, content, formattedContent, language)}
			</div>
		</div>
	);
}
