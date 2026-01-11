import { useEffect, useMemo, useState } from "react";
import { CollapsibleSidebar } from "../components/CollapsibleSidebar.tsx";
import { CompactTimeline } from "../components/CompactTimeline.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import { type SelectedItem, TraceTree } from "../components/TraceTree.tsx";
import type { Session, TimelineData } from "../types/timeline.ts";
import {
	copyToClipboard,
	formatDuration,
	formatSessionId,
	formatTokens,
} from "../utils/format.ts";

interface SessionDetailProps {
	sessionId: string;
	onBack: () => void;
}

export function SessionDetail({
	sessionId,
	onBack,
}: SessionDetailProps): React.ReactElement {
	const [session, setSession] = useState<Session | null>(null);
	const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [copiedId, setCopiedId] = useState(false);

	useEffect(() => {
		fetchData();
	}, [sessionId]);

	async function fetchData() {
		try {
			const [sessionRes, timelineRes] = await Promise.all([
				fetch(`/api/sessions/${sessionId}`),
				fetch(`/api/timeline/${sessionId}`),
			]);

			const sessionData = await sessionRes.json();
			const tlData = await timelineRes.json();

			setSession(sessionData);
			setTimelineData(tlData);
		} catch (error) {
			console.error("Failed to fetch data:", error);
		} finally {
			setLoading(false);
		}
	}

	// Calculate max duration for duration bars
	const maxDuration = useMemo(() => {
		if (!timelineData) return 1000;

		let max = 0;
		for (const lane of timelineData.lanes) {
			for (const turn of lane.turns) {
				const turnToolDuration = turn.steps
					.filter((s) => s.type === "tool")
					.reduce((sum, s) => sum + (s.toolDuration || 0), 0);
				if (turnToolDuration > max) max = turnToolDuration;
			}
		}
		return max || 1000;
	}, [timelineData]);

	// Handle ID copy
	async function handleCopyId() {
		const success = await copyToClipboard(sessionId);
		if (success) {
			setCopiedId(true);
			setTimeout(() => setCopiedId(false), 2000);
		}
	}

	if (loading) {
		return (
			<div className="loading-container">
				<div className="loading-spinner" />
				<p>Loading session...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="error-container">
				<p>Session not found</p>
				<button className="btn btn-primary" onClick={onBack}>
					Go Back
				</button>
			</div>
		);
	}

	return (
		<div className="session-detail-v2">
			{/* Header */}
			<header className="session-header-v2">
				<div className="header-left">
					<div className="session-title">
						<div className="session-icon">⚡</div>
						<span className="session-name">{session.projectName}</span>
					</div>
					<button
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
						>
							<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
							<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
						</svg>
						{copiedId ? "Copied!" : formatSessionId(sessionId, "short")}
					</button>
					<div className="header-tabs">
						<button className="header-tab active">Run</button>
						<button className="header-tab">Feedback</button>
						<button className="header-tab">Metadata</button>
					</div>
				</div>
				<div className="header-right">
					<div className="session-stats">
						<div className="mini-stat">
							<span className="mini-stat-icon duration">⏱</span>
							<span className="mini-stat-value">
								{formatDuration(session.totalDurationMs)}
							</span>
						</div>
						<div className="mini-stat">
							<span className="mini-stat-icon tokens">◈</span>
							<span className="mini-stat-value">
								{formatTokens(session.inputTokens + session.outputTokens)}
							</span>
						</div>
						<div className="mini-stat">
							<span className="mini-stat-icon tools">⚙</span>
							<span className="mini-stat-value">{session.toolCallCount}</span>
						</div>
					</div>
					<button className="btn btn-ghost" onClick={() => fetchData()}>
						<svg
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
					<button className="btn btn-ghost" onClick={onBack}>
						<svg
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10 19l-7-7m0 0l7-7m-7 7h18"
							/>
						</svg>
						Back
					</button>
				</div>
			</header>

			{/* Main Content Area */}
			<div className="content-wrapper">
				<CollapsibleSidebar
					collapsed={sidebarCollapsed}
					onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				>
					{timelineData ? (
						<TraceTree
							data={timelineData}
							maxDuration={maxDuration}
							onSelect={setSelectedItem}
							selectedItem={selectedItem}
						/>
					) : (
						<div className="loading-panel">Loading trace...</div>
					)}
				</CollapsibleSidebar>

				{/* Main Area: Timeline + Detail */}
				<main className="main-area">
					{/* Compact Timeline Section */}
					<section className="compact-timeline-section">
						{timelineData ? (
							<CompactTimeline
								data={timelineData}
								onSelect={setSelectedItem}
								selectedItem={selectedItem}
							/>
						) : (
							<div className="loading-panel">Loading timeline...</div>
						)}
					</section>

					{/* Detail Panel (always visible) */}
					<section className="detail-section">
						<DetailPanel selectedItem={selectedItem} />
					</section>
				</main>
			</div>

			<style>{`
        .session-detail-v2 {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          overflow: hidden;
        }

        /* Header */
        .session-header-v2 {
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
        }

        .session-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
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

        .header-tabs {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          margin-left: var(--space-md);
          padding-left: var(--space-md);
          border-left: 1px solid var(--border-subtle);
        }

        .header-tab {
          padding: var(--space-sm) var(--space-md);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
          position: relative;
        }

        .header-tab:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }

        .header-tab.active {
          color: var(--text-primary);
        }

        .header-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: var(--space-md);
          right: var(--space-md);
          height: 2px;
          background: var(--accent-primary);
          border-radius: 2px;
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
          padding-right: var(--space-md);
          border-right: 1px solid var(--border-subtle);
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

        .btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
        }

        .btn-primary {
          background: var(--accent-primary);
          color: white;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }

        .btn-ghost:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }

        /* Content Wrapper */
        .content-wrapper {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        /* Main Area */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        /* Compact Timeline Section */
        .compact-timeline-section {
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }

        /* Detail Section */
        .detail-section {
          flex: 1;
          overflow: hidden;
        }

        /* Loading & Error States */
        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: var(--space-md);
          color: var(--text-tertiary);
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-subtle);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-size: 13px;
        }
      `}</style>
		</div>
	);
}
