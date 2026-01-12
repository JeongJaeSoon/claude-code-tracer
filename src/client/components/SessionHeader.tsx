import type { ReactElement } from "react";
import { useState } from "react";
import { navigate, useTheme } from "../App.tsx";
import {
	copyToClipboard,
	formatDuration,
	formatSessionId,
	formatTokens,
} from "../utils/format.ts";

// Tracer logo - clean activity/pulse icon
function TracerLogo(): ReactElement {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="tracer-logo-svg"
			aria-hidden="true"
		>
			<path
				d="M22 12h-4l-3 9L9 3l-3 9H2"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

interface SessionHeaderStats {
	durationMs: number;
	tokens: number;
	toolCalls: number;
}

interface SessionHeaderProps {
	projectName?: string;
	sessionId?: string;
	stats: SessionHeaderStats;
}

export function SessionHeader({
	projectName,
	sessionId,
	stats,
}: SessionHeaderProps): JSX.Element {
	const [copiedId, setCopiedId] = useState(false);
	const { theme, setTheme } = useTheme();

	function toggleTheme() {
		setTheme(theme === "dark" ? "light" : "dark");
	}

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
					{/* Brand Logo */}
					<button
						type="button"
						className="brand-logo"
						onClick={handleHomeClick}
						title="Go to home"
					>
						<TracerLogo />
						<span className="brand-name">Tracer</span>
					</button>

					{/* Project Context */}
					{projectName && (
						<div className="project-context">
							<span className="context-divider" />
							<span className="project-name">{projectName}</span>
						</div>
					)}
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
					<button
						type="button"
						className="theme-toggle-btn"
						onClick={toggleTheme}
						title={
							theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
						}
						aria-label="Toggle theme"
					>
						{theme === "dark" ? (
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<circle cx="12" cy="12" r="5" />
								<line x1="12" y1="1" x2="12" y2="3" />
								<line x1="12" y1="21" x2="12" y2="23" />
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
								<line x1="1" y1="12" x2="3" y2="12" />
								<line x1="21" y1="12" x2="23" y2="12" />
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
							</svg>
						) : (
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
							</svg>
						)}
					</button>
				</div>
			</header>
		</>
	);
}
