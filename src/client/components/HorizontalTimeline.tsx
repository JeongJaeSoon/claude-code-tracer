import { useMemo, useRef } from "react";
import type { TimelineData, Turn, TimelineLane } from "../types/timeline";
import type { SelectedItem } from "./TraceTree";
import { TOOL_COLORS, LANE_COLORS, getToolColor } from "../constants/tools";

interface HorizontalTimelineProps {
	data: TimelineData;
	onSelect?: (item: SelectedItem | null) => void;
	selectedItem?: SelectedItem | null;
}

export function HorizontalTimeline({
	data,
	onSelect,
	selectedItem,
}: HorizontalTimelineProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	// Calculate total duration and time markers
	const { totalDuration, timeMarkers, lanes } = useMemo(() => {
		if (!data.lanes.length) {
			return { totalDuration: 0, timeMarkers: [], lanes: [] };
		}

		// Find the total duration across all lanes
		let maxEnd = 0;
		for (const lane of data.lanes) {
			for (const turn of lane.turns) {
				if (turn.endTime > maxEnd) maxEnd = turn.endTime;
			}
		}

		// Add 5% padding
		const total = maxEnd * 1.05;

		// Generate time markers (aim for 5-10 markers)
		const markers: { time: number; label: string }[] = [];
		const interval = calculateInterval(total);
		for (let t = 0; t <= total; t += interval) {
			markers.push({
				time: t,
				label: formatTime(t),
			});
		}

		return {
			totalDuration: total,
			timeMarkers: markers,
			lanes: data.lanes,
		};
	}, [data]);

	// Handle turn click
	const handleTurnClick = (turn: Turn, lane: TimelineLane) => {
		if (onSelect) {
			onSelect({
				type: "turn",
				turn,
				lane,
			});
		}
	};

	// Check if turn is selected
	const isTurnSelected = (turn: Turn): boolean => {
		if (!selectedItem || selectedItem.type !== "turn") return false;
		return selectedItem.turn?.id === turn.id;
	};

	if (!lanes.length || totalDuration === 0) {
		return (
			<div className="timeline-empty">
				<p>No timeline data available</p>
			</div>
		);
	}

	return (
		<div className="horizontal-timeline" ref={containerRef}>
			{/* Time Axis Header */}
			<div className="time-axis">
				<div className="lane-label-spacer"></div>
				<div className="time-axis-track">
					{timeMarkers.map((marker, i) => (
						<div
							key={i}
							className="time-marker"
							style={{ left: `${(marker.time / totalDuration) * 100}%` }}
						>
							<span className="marker-label">{marker.label}</span>
							<div className="marker-line"></div>
						</div>
					))}
				</div>
			</div>

			{/* Lanes */}
			<div className="lanes-container">
				{lanes.map((lane) => (
					<div key={lane.id} className="lane">
						<div className="lane-label">
							<div
								className="lane-color"
								style={{
									background:
										lane.id === "main"
											? LANE_COLORS.main
											: LANE_COLORS.subagent,
								}}
							></div>
							<span className="lane-name">{lane.name}</span>
							<span className="lane-turn-count">{lane.turns.length} turns</span>
						</div>
						<div className="lane-track">
							{/* Grid lines */}
							{timeMarkers.map((marker, i) => (
								<div
									key={i}
									className="grid-line"
									style={{ left: `${(marker.time / totalDuration) * 100}%` }}
								></div>
							))}

							{/* Turn bars */}
							{lane.turns.map((turn, turnIdx) => {
								const left = (turn.startTime / totalDuration) * 100;
								const width =
									((turn.endTime - turn.startTime) / totalDuration) * 100;
								const isSelected = isTurnSelected(turn);

								// Get dominant tool color
								const toolSteps = turn.steps.filter((s) => s.type === "tool");
								const dominantTool = toolSteps[0]?.toolName || "";
								const barColor = dominantTool
									? getToolColor(dominantTool)
									: lane.color;

								return (
									<div
										key={turn.id}
										className={`turn-bar ${isSelected ? "selected" : ""}`}
										style={{
											left: `${left}%`,
											width: `${Math.max(width, 0.5)}%`,
											background: barColor,
										}}
										onClick={() => handleTurnClick(turn, lane)}
										title={`Turn ${turnIdx + 1}: ${turn.userPrompt.content.slice(0, 50)}...`}
									>
										<span className="turn-label">T{turnIdx + 1}</span>
										{toolSteps.length > 0 && (
											<span className="turn-tools">
												{toolSteps.length} tools
											</span>
										)}
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>

			{/* Legend */}
			<div className="timeline-legend">
				<span className="legend-title">Tools:</span>
				{Object.entries(TOOL_COLORS)
					.slice(0, 6)
					.map(([name, color]) => (
						<div key={name} className="legend-item">
							<div className="legend-color" style={{ background: color }}></div>
							<span>{name}</span>
						</div>
					))}
			</div>

			<style>{`
        .horizontal-timeline {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: var(--space-md);
          overflow: hidden;
        }

        .timeline-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
        }

        /* Time Axis */
        .time-axis {
          display: flex;
          flex-shrink: 0;
          height: 40px;
          margin-bottom: var(--space-sm);
        }

        .lane-label-spacer {
          width: 140px;
          flex-shrink: 0;
        }

        .time-axis-track {
          flex: 1;
          position: relative;
          border-bottom: 1px solid var(--border-subtle);
        }

        .time-marker {
          position: absolute;
          bottom: 0;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .marker-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .marker-line {
          width: 1px;
          height: 8px;
          background: var(--border-default);
        }

        /* Lanes */
        .lanes-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .lane {
          display: flex;
          align-items: stretch;
          min-height: 48px;
        }

        .lane-label {
          width: 140px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          padding-right: var(--space-sm);
        }

        .lane-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .lane-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        .lane-turn-count {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .lane-track {
          flex: 1;
          position: relative;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          min-height: 40px;
        }

        .grid-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--border-subtle);
          opacity: 0.5;
        }

        /* Turn Bars */
        .turn-bar {
          position: absolute;
          top: 4px;
          bottom: 4px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-sm);
          gap: var(--space-xs);
          transition: all 0.15s;
          overflow: hidden;
          min-width: 32px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .turn-bar:hover {
          transform: scaleY(1.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          z-index: 10;
        }

        .turn-bar.selected {
          outline: 2px solid var(--accent-primary);
          outline-offset: 1px;
          transform: scaleY(1.1);
          z-index: 20;
        }

        .turn-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        .turn-tools {
          font-family: var(--font-mono);
          font-size: 9px;
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
        }

        /* Legend */
        .timeline-legend {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          padding-top: var(--space-md);
          border-top: 1px solid var(--border-subtle);
          margin-top: var(--space-md);
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .legend-title {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .legend-color {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
      `}</style>
		</div>
	);
}

// Helper: Calculate nice interval for time markers
function calculateInterval(totalMs: number): number {
	const targetMarkers = 6;
	const rawInterval = totalMs / targetMarkers;

	// Round to nice numbers (1s, 5s, 10s, 30s, 1m, 5m, 10m, etc.)
	const niceIntervals = [
		1000,
		2000,
		5000,
		10000,
		15000,
		30000, // seconds
		60000,
		120000,
		300000,
		600000,
		900000, // minutes
		1800000,
		3600000, // half hour, hour
	];

	for (const interval of niceIntervals) {
		if (interval >= rawInterval * 0.8) {
			return interval;
		}
	}

	return niceIntervals[niceIntervals.length - 1] ?? 3600000;
}

// Helper: Format time for display
function formatTime(ms: number): string {
	if (ms === 0) return "0s";

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m${seconds % 60 > 0 ? (seconds % 60) + "s" : ""}`;
	}
	return `${seconds}s`;
}
