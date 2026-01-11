import { useState } from "react";
import { navigate } from "../App.tsx";
import {
	copyToClipboard,
	formatDuration,
	formatSessionId,
	formatTokens,
} from "../utils/format.ts";

interface SessionHeaderStats {
	durationMs: number;
	tokens: number;
	toolCalls: number;
}

interface SessionHeaderProps {
	title: string;
	projectName?: string;
	sessionId?: string;
	stats: SessionHeaderStats;
}

export function SessionHeader({
	title,
	projectName,
	sessionId,
	stats,
}: SessionHeaderProps): JSX.Element {
	const [copiedId, setCopiedId] = useState(false);

	async function handleCopyId() {
		if (!sessionId) return;
		const success = await copyToClipboard(sessionId);
		if (success) {
			setCopiedId(true);
			setTimeout(() => setCopiedId(false), 2000);
		}
	}

	function handleHomeClick() {
		navigate("sessions");
	}

	return (
		<>
			<header className="session-header">
				<div className="header-left">
					<div className="session-title">
						<button
							type="button"
							className="session-icon"
							onClick={handleHomeClick}
							title="Go to home"
						>
							<span>&#9889;</span>
						</button>
						<span className="session-name">{title}</span>
					</div>
					{projectName && <span className="project-name">{projectName}</span>}
					{sessionId && (
						<button
							type="button"
							className={`session-id-btn ${copiedId ? "copied" : ""}`}
							onClick={handleCopyId}
							title="Copy full session ID"
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								aria-hidden="true"
							>
								<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
								<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
							</svg>
							{copiedId ? "Copied!" : formatSessionId(sessionId, "short")}
						</button>
					)}
				</div>
				<div className="header-right">
					<div className="session-stats">
						<div className="mini-stat">
							<span className="mini-stat-icon duration">&#9201;</span>
							<span className="mini-stat-value">
								{formatDuration(stats.durationMs)}
							</span>
						</div>
						<div className="mini-stat">
							<span className="mini-stat-icon tokens">&#9670;</span>
							<span className="mini-stat-value">
								{formatTokens(stats.tokens)}
							</span>
						</div>
						<div className="mini-stat">
							<span className="mini-stat-icon tools">&#9881;</span>
							<span className="mini-stat-value">{stats.toolCalls}</span>
						</div>
					</div>
				</div>
			</header>

			<style>{`
				.session-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: var(--space-sm) var(--space-lg);
					border-bottom: 1px solid var(--border-subtle);
					background: var(--bg-secondary);
					flex-shrink: 0;
					gap: var(--space-lg);
				}

				.header-left {
					display: flex;
					align-items: center;
					gap: var(--space-md);
				}

				.session-title {
					display: flex;
					align-items: center;
					gap: var(--space-sm);
				}

				.session-icon {
					width: 32px;
					height: 32px;
					background: linear-gradient(135deg, var(--accent-primary), #6366f1);
					border-radius: var(--radius-sm);
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 14px;
					border: none;
					cursor: pointer;
					transition: all 0.15s ease;
				}

				.session-icon:hover {
					transform: scale(1.05);
					box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
				}

				.session-icon span {
					line-height: 1;
				}

				.session-name {
					font-size: 16px;
					font-weight: 600;
					color: var(--text-primary);
				}

				.project-name {
					font-size: 13px;
					font-weight: 500;
					color: var(--text-secondary);
					padding: var(--space-xs) var(--space-sm);
					background: var(--bg-tertiary);
					border-radius: var(--radius-sm);
				}

				.session-id-btn {
					display: flex;
					align-items: center;
					gap: var(--space-xs);
					padding: var(--space-xs) var(--space-sm);
					background: var(--bg-tertiary);
					border: 1px solid var(--border-subtle);
					border-radius: var(--radius-sm);
					color: var(--text-muted);
					font-family: var(--font-mono);
					font-size: 11px;
					cursor: pointer;
					transition: all 0.15s ease;
				}

				.session-id-btn:hover {
					border-color: var(--accent-primary);
					color: var(--accent-primary);
				}

				.session-id-btn.copied {
					background: var(--success);
					border-color: var(--success);
					color: white;
				}

				.header-right {
					display: flex;
					align-items: center;
					gap: var(--space-sm);
				}

				.session-stats {
					display: flex;
					align-items: center;
					gap: var(--space-md);
				}

				.mini-stat {
					display: flex;
					align-items: center;
					gap: var(--space-xs);
				}

				.mini-stat-icon {
					font-size: 12px;
				}

				.mini-stat-icon.duration { color: #10b981; }
				.mini-stat-icon.tokens { color: #3b82f6; }
				.mini-stat-icon.tools { color: #f97316; }

				.mini-stat-value {
					font-family: var(--font-mono);
					font-size: 12px;
					font-weight: 500;
					color: var(--text-secondary);
				}
			`}</style>
		</>
	);
}
