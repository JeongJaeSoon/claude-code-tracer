import { useEffect, useMemo, useState } from "react";
import { CollapsibleSidebar } from "../components/CollapsibleSidebar.tsx";
import { CompactTimeline } from "../components/CompactTimeline.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import { SessionHeader } from "../components/SessionHeader.tsx";
import { type SelectedItem, TraceTree } from "../components/TraceTree.tsx";
import type { Session, TimelineData } from "../types/timeline.ts";

interface SessionDetailProps {
	sessionId: string;
}

export function SessionDetail({ sessionId }: SessionDetailProps): JSX.Element {
	const [session, setSession] = useState<Session | null>(null);
	const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
				<button
					className="btn btn-primary"
					onClick={() => (window.location.hash = "sessions")}
				>
					Go Back
				</button>
			</div>
		);
	}

	return (
		<div className="session-detail-v2">
			<SessionHeader
				title="Claude Code Tracer"
				projectName={session.projectName}
				sessionId={sessionId}
				stats={{
					durationMs: session.totalDurationMs,
					tokens: session.inputTokens + session.outputTokens,
					toolCalls: session.toolCallCount,
				}}
			/>

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
