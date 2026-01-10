import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Copy button component for code blocks
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [code]);

  return (
    <button className="md-copy-btn" onClick={handleCopy} title="Copy code">
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5,15H4a2,2,0,0,1-2-2V4A2,2,0,0,1,4,2H15a2,2,0,0,1,2,2V5" />
        </svg>
      )}
    </button>
  );
}

// Language badge component
function LanguageBadge({ language }: { language: string }) {
  if (!language) return null;
  return <span className="md-lang-badge">{language}</span>;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`md-renderer ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ className: codeClassName, children, node, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const language = match ? match[1] : "";
            const codeString = String(children).replace(/\n$/, "");

            // Check if this is a block-level code (has language or multi-line)
            const isBlock = match || codeString.includes("\n");

            if (isBlock) {
              return (
                <div className="md-code-block">
                  <div className="md-code-header">
                    <LanguageBadge language={language || "code"} />
                    <CopyButton code={codeString} />
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus as Record<string, React.CSSProperties>}
                    language={language || "text"}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 6px 6px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      padding: "12px 16px",
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            // Inline code
            return (
              <code className="md-inline-code" {...props}>
                {children}
              </code>
            );
          },

          // Custom table styling
          table({ children }) {
            return (
              <div className="md-table-wrapper">
                <table className="md-table">{children}</table>
              </div>
            );
          },

          // Custom blockquote
          blockquote({ children }) {
            return <blockquote className="md-blockquote">{children}</blockquote>;
          },

          // Custom link
          a({ href, children }) {
            return (
              <a href={href} className="md-link" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },

          // Custom pre tag (already handled by code)
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>

      <style>{markdownStyles}</style>
    </div>
  );
}

const markdownStyles = `
  .md-renderer {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
  }

  /* Headings */
  .md-renderer h1,
  .md-renderer h2,
  .md-renderer h3,
  .md-renderer h4,
  .md-renderer h5,
  .md-renderer h6 {
    margin: 1.2em 0 0.6em 0;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
  }

  .md-renderer h1 { font-size: 1.5em; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.3em; }
  .md-renderer h2 { font-size: 1.3em; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.3em; }
  .md-renderer h3 { font-size: 1.15em; }
  .md-renderer h4 { font-size: 1em; }

  .md-renderer h1:first-child,
  .md-renderer h2:first-child,
  .md-renderer h3:first-child {
    margin-top: 0;
  }

  /* Paragraphs */
  .md-renderer p {
    margin: 0.8em 0;
  }

  .md-renderer p:first-child {
    margin-top: 0;
  }

  .md-renderer p:last-child {
    margin-bottom: 0;
  }

  /* Lists */
  .md-renderer ul,
  .md-renderer ol {
    margin: 0.6em 0;
    padding-left: 1.5em;
  }

  .md-renderer li {
    margin: 0.3em 0;
  }

  .md-renderer li > p {
    margin: 0;
  }

  /* Task lists (GFM) */
  .md-renderer input[type="checkbox"] {
    margin-right: 0.5em;
    accent-color: var(--accent-primary);
  }

  /* Code block container */
  .md-code-block {
    margin: 1em 0;
    border-radius: 6px;
    overflow: hidden;
    background: #282c34;
    border: 1px solid var(--border-subtle);
  }

  .md-code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .md-lang-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }

  .md-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .md-copy-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  /* Inline code */
  .md-inline-code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.15em 0.4em;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: #e06c75;
  }

  /* Tables */
  .md-table-wrapper {
    margin: 1em 0;
    overflow-x: auto;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
  }

  .md-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .md-table th,
  .md-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }

  .md-table th {
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.05em;
  }

  .md-table tr:last-child td {
    border-bottom: none;
  }

  .md-table tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }

  /* Blockquotes */
  .md-blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 3px solid var(--accent-primary);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-secondary);
  }

  .md-blockquote p {
    margin: 0.3em 0;
  }

  /* Links */
  .md-link {
    color: var(--accent-primary);
    text-decoration: none;
    transition: opacity 0.15s ease;
  }

  .md-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* Horizontal rule */
  .md-renderer hr {
    margin: 1.5em 0;
    border: none;
    border-top: 1px solid var(--border-subtle);
  }

  /* Bold and italic */
  .md-renderer strong {
    font-weight: 600;
    color: var(--text-primary);
  }

  .md-renderer em {
    font-style: italic;
  }

  /* Strikethrough (GFM) */
  .md-renderer del {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  /* Images */
  .md-renderer img {
    max-width: 100%;
    border-radius: 6px;
    margin: 0.5em 0;
  }
`;
