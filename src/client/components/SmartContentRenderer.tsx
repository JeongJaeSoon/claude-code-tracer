import { useState, useCallback, useMemo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type ContentType = "json" | "markdown" | "code" | "cli" | "plain";

interface SmartContentRendererProps {
  content: string;
  className?: string;
  forceType?: ContentType;  // Override auto-detection
  language?: string;        // For code blocks
}

// Copy button component
function CopyButton({ content, className = "" }: { content: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [content]);

  return (
    <button
      className={`smart-copy-btn ${className}`}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20,6 9,17 4,12" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5,15H4a2,2,0,0,1-2-2V4A2,2,0,0,1,4,2H15a2,2,0,0,1,2,2V5" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// Detect content type
function detectContentType(content: string): ContentType {
  if (!content || typeof content !== "string") return "plain";

  const trimmed = content.trim();

  // JSON detection
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON, continue detection
    }
  }

  // Markdown detection - check for common patterns
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers
    /^```[\s\S]*```$/m,     // Code blocks
    /^\s*[-*+]\s/m,         // Unordered lists
    /^\s*\d+\.\s/m,         // Ordered lists
    /\[.+\]\(.+\)/,         // Links
    /\*\*.+\*\*/,           // Bold
    /\*.+\*/,               // Italic (but not in CLI paths)
    /^\s*>\s/m,             // Blockquotes
    /\|.+\|.+\|/,           // Tables
    /^---$/m,               // Horizontal rules
  ];

  const markdownScore = markdownPatterns.filter(p => p.test(trimmed)).length;
  if (markdownScore >= 2) return "markdown";

  // CLI/terminal output detection
  const cliPatterns = [
    /^\s*\$\s/m,                          // Shell prompt
    /^(\/[\w\-.]+)+/m,                    // Unix paths
    /^[A-Z]:\\[\w\\]+/m,                  // Windows paths
    /^\s*(npm|yarn|bun|git|docker)\s/m,  // Common CLI tools
    /^(error|warning|info):/im,          // Log-style output
    /\x1b\[[\d;]*m/,                      // ANSI escape codes
    /^\d{4}-\d{2}-\d{2}/m,               // Timestamps
    /^[\w\-.]+\s+\d+\s+\w+/m,            // ls-style output
  ];

  const cliScore = cliPatterns.filter(p => p.test(trimmed)).length;
  if (cliScore >= 1) return "cli";

  // If has code-like patterns (indentation, brackets)
  if (trimmed.includes("function ") ||
      trimmed.includes("const ") ||
      trimmed.includes("class ") ||
      trimmed.includes("import ") ||
      /^\s{2,}/m.test(trimmed)) {
    return "code";
  }

  return "plain";
}

// Format JSON with pretty print
function formatJson(content: string): string {
  try {
    const parsed = JSON.parse(content.trim());
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

export function SmartContentRenderer({
  content,
  className = "",
  forceType,
  language,
}: SmartContentRendererProps) {
  const contentType = forceType || detectContentType(content);

  const formattedContent = useMemo(() => {
    if (contentType === "json") {
      return formatJson(content);
    }
    return content;
  }, [content, contentType]);

  return (
    <div className={`smart-content ${className}`}>
      {/* Copy button - always visible */}
      <div className="smart-content-header">
        <span className="content-type-badge">{contentType.toUpperCase()}</span>
        <CopyButton content={content} />
      </div>

      <div className="smart-content-body">
        {contentType === "json" && (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language="json"
            customStyle={{
              margin: 0,
              borderRadius: "0 0 6px 6px",
              fontSize: "12px",
              lineHeight: "1.5",
              padding: "12px 16px",
              background: "#1a1d23",
            }}
          >
            {formattedContent}
          </SyntaxHighlighter>
        )}

        {contentType === "markdown" && (
          <div className="smart-markdown-wrapper">
            <MarkdownRenderer content={content} />
          </div>
        )}

        {contentType === "code" && (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language || "typescript"}
            customStyle={{
              margin: 0,
              borderRadius: "0 0 6px 6px",
              fontSize: "12px",
              lineHeight: "1.5",
              padding: "12px 16px",
              background: "#1a1d23",
            }}
          >
            {content}
          </SyntaxHighlighter>
        )}

        {contentType === "cli" && (
          <div className="smart-cli-output">
            <pre>{content}</pre>
          </div>
        )}

        {contentType === "plain" && (
          <div className="smart-plain-text">
            {content}
          </div>
        )}
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

  .smart-copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .smart-copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-secondary);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .smart-copy-btn span {
    font-family: var(--font-mono);
    font-weight: 500;
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
