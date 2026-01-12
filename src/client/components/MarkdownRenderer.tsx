import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./CopyButton.tsx";
import { SyntaxHighlighter, vscDarkPlus } from "./syntaxHighlighter.ts";

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

interface LanguageBadgeProps {
	language: string;
}

function LanguageBadge({
	language,
}: LanguageBadgeProps): React.ReactElement | null {
	if (!language) return null;
	return <span className="md-lang-badge">{language}</span>;
}

const CODE_BLOCK_STYLE: React.CSSProperties = {
	margin: 0,
	borderRadius: "0 0 6px 6px",
	fontSize: "12px",
	lineHeight: "1.5",
	padding: "12px 16px",
};

export function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps): React.ReactElement {
	return (
		<div className={`md-renderer ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					code({ className: codeClassName, children, ...props }) {
						const match = /language-(\w+)/.exec(codeClassName || "");
						const language = match ? match[1] : "";
						const codeString = String(children).replace(/\n$/, "");
						const isBlock = match || codeString.includes("\n");

						if (isBlock) {
							return (
								<div className="md-code-block">
									<div className="md-code-header">
										<LanguageBadge language={language || "code"} />
										<CopyButton content={codeString} variant="compact" />
									</div>
									<SyntaxHighlighter
										style={vscDarkPlus as Record<string, React.CSSProperties>}
										language={language || "text"}
										PreTag="div"
										customStyle={CODE_BLOCK_STYLE}
									>
										{codeString}
									</SyntaxHighlighter>
								</div>
							);
						}

						return (
							<code className="md-inline-code" {...props}>
								{children}
							</code>
						);
					},
					table({ children }) {
						return (
							<div className="md-table-wrapper">
								<table className="md-table">{children}</table>
							</div>
						);
					},
					blockquote({ children }) {
						return (
							<blockquote className="md-blockquote">{children}</blockquote>
						);
					},
					a({ href, children }) {
						return (
							<a
								href={href}
								className="md-link"
								target="_blank"
								rel="noopener noreferrer"
							>
								{children}
							</a>
						);
					},
					pre({ children }) {
						return <>{children}</>;
					},
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
