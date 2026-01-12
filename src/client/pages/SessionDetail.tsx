import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSidebar } from "../components/CollapsibleSidebar.tsx";
import { updateSelectedItem } from "../utils/router.ts";
import { CompactTimeline } from "../components/CompactTimeline.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import { SessionHeader } from "../components/SessionHeader.tsx";
import { type SelectedItem, TraceTree } from "../components/TraceTree.tsx";
import type { Session, TimelineData } from "../types/timeline.ts";

interface SessionDetailProps {
	sessionId: string;
	initialItemId?: string;
}

export function SessionDetail({
	sessionId,
	initialItemId,
}: SessionDetailProps) {
	const [session, setSession] = useState<Session | null>(null);
	const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	// Handle item selection and URL update
	const handleSelectItem = useCallback(
		(item: SelectedItem | null) => {
			setSelectedItem(item);
			// Get the correct ID based on item type
			let itemId: string | null = null;
			if (item) {
				switch (item.type) {
					case "step":
						itemId = item.step?.id ?? null;
						break;
					case "finalResponse":
						itemId = item.finalResponse?.id ?? null;
						break;
					case "prompt":
					case "turn":
						itemId = item.turn?.id ?? null;
						break;
				}
			}
			updateSelectedItem(sessionId, itemId);
		},
		[sessionId],
	);

	const fetchData = useCallback(async () => {
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
	}, [sessionId]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

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

	// Find and select initial item from URL
	// Note: selectedItem is intentionally excluded from deps to prevent
	// overriding user's UI selection when they click items
	useEffect(() => {
		if (!timelineData || !initialItemId) return;

		// Search for the item by ID
		for (const lane of timelineData.lanes) {
			for (const turn of lane.turns) {
				// Check turn ID
				if (turn.id === initialItemId) {
					setSelectedItem({ type: "prompt", turn, lane });
					return;
				}
				// Check step IDs
				for (const step of turn.steps) {
					if (step.id === initialItemId) {
						setSelectedItem({ type: "step", step, turn, lane });
						return;
					}
				}
				// Check final response ID
				if (turn.finalResponse?.id === initialItemId) {
					setSelectedItem({
						type: "finalResponse",
						finalResponse: turn.finalResponse,
						turn,
						lane,
					});
					return;
				}
			}
		}
	}, [timelineData, initialItemId]);

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
				projectName={session.projectName}
				sessionId={sessionId}
				stats={{
					durationMs: session.totalDurationMs ?? 0,
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
							onSelect={handleSelectItem}
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
								onSelect={handleSelectItem}
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
		</div>
	);
}
