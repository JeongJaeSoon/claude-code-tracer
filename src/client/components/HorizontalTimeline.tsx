import { useMemo, useRef } from "react";
import { getToolColor, LANE_COLORS, TOOL_COLORS } from "../constants/tools";
import type { TimelineData, TimelineLane, Turn } from "../types/timeline";
import type { SelectedItem } from "./TraceTree";

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
