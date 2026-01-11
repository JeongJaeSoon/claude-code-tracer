import { useMemo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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
	/^\s*\$\s/m,
	/^(\/[\w\-.]+)+/m,
	/^[A-Z]:\\[\w\\]+/m,
	/^\s*(npm|yarn|bun|git|docker)\s/m,
	/^(error|warning|info):/im,
	/\x1b\[[\d;]*m/,
	/^\d{4}-\d{2}-\d{2}/m,
	/^[\w\-.]+\s+\d+\s+\w+/m,
];

function detectContentType(content: string): ContentType {
	if (!content || typeof content !== "string") return "plain";

	const trimmed = content.trim();

	if (
		(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
		(trimmed.startsWith("[") && trimmed.endsWith("]"))
	) {
		try {
			JSON.parse(trimmed);
			return "json";
		} catch {
			// Not valid JSON, continue detection
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
	try {
		const parsed = JSON.parse(content.trim());
		return JSON.stringify(parsed, null, 2);
	} catch {
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
				<div className="smart-cli-output">
					<pre>{content}</pre>
				</div>
			);
		case "plain":
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
			<style>{smartContentStyles}</style>
		</div>
	);
}

const smartContentStyles = `
  .smart-content {
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .smart-content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--border-subtle);
  }

  .content-type-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .smart-content-body {
    overflow-x: auto;
  }

  /* Markdown wrapper */
  .smart-markdown-wrapper {
    padding: 16px;
    max-height: 600px;
    overflow-y: auto;
  }

  /* CLI output styling */
  .smart-cli-output {
    padding: 12px 16px;
    background: #0d1117;
  }

  .smart-cli-output pre {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    color: #c9d1d9;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Plain text styling */
  .smart-plain-text {
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Special styling for different content types */
  .smart-content[data-type="json"] .smart-content-header {
    background: rgba(235, 203, 139, 0.05);
  }

  .smart-content[data-type="json"] .content-type-badge {
    color: #ebcb8b;
  }

  .smart-content[data-type="cli"] .smart-content-header {
    background: rgba(143, 188, 143, 0.05);
  }

  .smart-content[data-type="cli"] .content-type-badge {
    color: #8fbc8f;
  }

  .smart-content[data-type="markdown"] .smart-content-header {
    background: rgba(136, 192, 208, 0.05);
  }

  .smart-content[data-type="markdown"] .content-type-badge {
    color: #88c0d0;
  }
`;
