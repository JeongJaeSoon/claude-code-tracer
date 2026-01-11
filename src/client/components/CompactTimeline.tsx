import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { getToolColor, TOOL_COLORS } from "../constants/tools.ts";
import type {
	TimelineData,
	Turn,
	TimelineLane,
	TurnStep,
	AssistantMessage,
} from "../types/timeline.ts";
import type { SelectedItem } from "./TraceTree.tsx";

interface CompactTimelineProps {
	data: TimelineData;
	selectedItem: SelectedItem | null;
	onSelect: (item: SelectedItem) => void;
}

// Timeline marker types
type MarkerType = "thinking" | "assistant_text" | "tool" | "finalResponse";

interface TurnMarker {
	id: string;
	type: MarkerType;
	startTime: number;
	duration?: number;
	toolName?: string;
	step?: TurnStep;
	finalResponse?: AssistantMessage;
	relativeX?: number;
}

interface TurnBlock {
	id: string;
	turnIndex: number;
	turn: Turn;
	lane: TimelineLane;
	startTime: number;
	endTime: number;
	duration: number;
	markers: TurnMarker[];
	width: number;
	xPos: number;
}

// Time to spacing mapping (seconds -> pixels)
// 마커 크기 10px 기준, 30% 겹침 = 7px 간격
function getSpacingForDuration(durationMs: number): number {
	const seconds = durationMs / 1000;
	if (seconds <= 0.05) return 7; // 거의 동시 → 30% 겹침
	if (seconds <= 0.2) return 10; // ~0.2초 → 딱 붙음
	if (seconds <= 0.5) return 14; // ~0.5초 → 약간 간격
	if (seconds <= 1) return 20; // ~1초 → 중간
	if (seconds <= 3) return 28; // 1~3초 → 넓음
	if (seconds <= 10) return 38; // 3~10초 → 더 넓음
	return 50; // 10초+ → 매우 넓음
}

export function CompactTimeline({
	data,
	selectedItem,
	onSelect,
}: CompactTimelineProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const legendRef = useRef<HTMLDivElement>(null);
	const [hoveredTurnId, setHoveredTurnId] = useState<string | null>(null);
	const [showLegend, setShowLegend] = useState(false);
	const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// 범례 외부 클릭 시 닫기
	useEffect(() => {
		if (!showLegend) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
				setShowLegend(false);
			}
		};

		// 다음 틱에 리스너 추가 (버튼 클릭 이벤트와 충돌 방지)
		const timeoutId = setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 0);

		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener("click", handleClickOutside);
		};
	}, [showLegend]);

	// Build turn blocks with time-based marker spacing
	const { turnBlocks, totalWidth } = useMemo(() => {
		const blocks: TurnBlock[] = [];
		let turnIndex = 0;

		const TURN_PADDING = 14;
		const MIN_MARKER_SPACING = 10;

		data.lanes.forEach((lane) => {
			lane.turns.forEach((turn) => {
				turnIndex++;
				const duration = turn.endTime - turn.startTime || 1000;

				const markers: TurnMarker[] = [];

				turn.steps.forEach((step) => {
					markers.push({
						id: step.id,
						type: step.type as MarkerType,
						startTime: step.startTime,
						duration: step.toolDuration,
						toolName: step.toolName,
						step,
					});
				});

				if (turn.finalResponse) {
					markers.push({
						id: turn.finalResponse.id,
						type: "finalResponse",
						startTime: turn.endTime - 50,
						finalResponse: turn.finalResponse,
					});
				}

				markers.sort((a, b) => a.startTime - b.startTime);

				// Calculate width based on actual time gaps
				let turnWidth = TURN_PADDING * 2;
				const spacings: number[] = [];

				if (markers.length > 1) {
					for (let i = 1; i < markers.length; i++) {
						const curr = markers[i];
						const prev = markers[i - 1];
						if (curr && prev) {
							const timeDiff = curr.startTime - prev.startTime;
							// 시간이 짧으면 겹침 허용 (MIN_MARKER_SPACING 무시)
							const allowOverlap = timeDiff <= 50; // 0.05초 이하
							const baseSpacing = getSpacingForDuration(timeDiff);
							const spacing = allowOverlap
								? baseSpacing
								: Math.max(MIN_MARKER_SPACING, baseSpacing);
							spacings.push(spacing);
							turnWidth += spacing;
						}
					}
				} else if (markers.length === 1) {
					turnWidth = TURN_PADDING * 2 + 24;
				}

				turnWidth = Math.max(60, turnWidth);

				// Calculate positions preserving actual spacing ratios
				if (markers.length > 0) {
					let currentX = 0;
					markers.forEach((marker, idx) => {
						if (idx === 0) {
							marker.relativeX = 0;
						} else {
							const prevSpacing = spacings[idx - 1] ?? MIN_MARKER_SPACING;
							currentX += prevSpacing;
							const contentWidth = turnWidth - TURN_PADDING * 2;
							marker.relativeX =
								contentWidth > 0 ? (currentX / contentWidth) * 100 : 50;
						}
					});

					// Only normalize if multiple markers
					if (markers.length > 1) {
						const lastMarker = markers[markers.length - 1];
						const maxX = lastMarker?.relativeX || 0;
						if (maxX > 0 && maxX !== 100) {
							markers.forEach((marker) => {
								marker.relativeX = ((marker.relativeX || 0) / maxX) * 100;
							});
						}
					} else {
						const firstMarker = markers[0];
						if (firstMarker) {
							firstMarker.relativeX = 50;
						}
					}
				}

				blocks.push({
					id: turn.id,
					turnIndex,
					turn,
					lane,
					startTime: turn.startTime,
					endTime: turn.endTime,
					duration,
					markers,
					width: turnWidth,
					xPos: 0,
				});
			});
		});

		let currentX = 0;
		blocks.forEach((block) => {
			block.xPos = currentX;
			currentX += block.width + 4;
		});

		return {
			turnBlocks: blocks,
			totalWidth: currentX + 20,
		};
	}, [data]);

	const selectedTurnId = selectedItem?.turn?.id;
	const selectedStepId = selectedItem?.step?.id;
	const selectedFinalId = selectedItem?.finalResponse?.id;

	// Scroll to selected turn - align left edge with small margin
	useEffect(() => {
		if (!containerRef.current || !selectedTurnId) return;

		const container = containerRef.current;
		const targetBlock = turnBlocks.find((b) => b.id === selectedTurnId);

		if (targetBlock) {
			const scrollTarget = targetBlock.xPos - 16; // 좌측 여백 16px

			container.scrollTo({
				left: Math.max(0, scrollTarget),
				behavior: "smooth",
			});
		}
	}, [selectedTurnId, turnBlocks]);

	// Navigation handlers
	const scrollAmount = 1000;

	const handleScrollLeft = useCallback(() => {
		if (!containerRef.current) return;
		containerRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
	}, []);

	const handleScrollRight = useCallback(() => {
		if (!containerRef.current) return;
		containerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
	}, []);

	const handleScrollStart = useCallback(() => {
		if (!containerRef.current) return;
		containerRef.current.scrollTo({ left: 0, behavior: "smooth" });
	}, []);

	const handleScrollEnd = useCallback(() => {
		if (!containerRef.current) return;
		containerRef.current.scrollTo({
			left: containerRef.current.scrollWidth,
			behavior: "smooth",
		});
	}, []);

	// Handle click with double-click detection
	const handleNavClick = (direction: "left" | "right") => {
		if (clickTimeoutRef.current) {
			clearTimeout(clickTimeoutRef.current);
			clickTimeoutRef.current = null;
			// Double click - go to end
			if (direction === "left") {
				handleScrollStart();
			} else {
				handleScrollEnd();
			}
		} else {
			// Single click - schedule action
			clickTimeoutRef.current = setTimeout(() => {
				clickTimeoutRef.current = null;
				if (direction === "left") {
					handleScrollLeft();
				} else {
					handleScrollRight();
				}
			}, 200);
		}
	};

	const handleTurnClick = (block: TurnBlock, e: React.MouseEvent) => {
		if ((e.target as HTMLElement).closest(".marker")) return;

		onSelect({
			type: "prompt",
			turn: block.turn,
			lane: block.lane,
		});
	};

	const handleMarkerClick = (
		block: TurnBlock,
		marker: TurnMarker,
		e: React.MouseEvent,
	) => {
		e.stopPropagation();

		if (marker.type === "finalResponse" && marker.finalResponse) {
			onSelect({
				type: "finalResponse",
				finalResponse: marker.finalResponse,
				turn: block.turn,
				lane: block.lane,
			});
		} else if (marker.step) {
			onSelect({
				type: "step",
				step: marker.step,
				turn: block.turn,
				lane: block.lane,
			});
		}
	};

	const isMarkerSelected = (marker: TurnMarker): boolean => {
		if (marker.type === "finalResponse") {
			return selectedFinalId === marker.id;
		}
		return selectedStepId === marker.id;
	};

	const isTurnActive = (block: TurnBlock): boolean => {
		return selectedTurnId === block.id || hoveredTurnId === block.id;
	};

	if (turnBlocks.length === 0) {
		return (
			<div className="compact-timeline empty">
				<span>No timeline data</span>
				<style>{compactTimelineStyles}</style>
			</div>
		);
	}

	// Tool entries for legend
	const toolEntries = Object.entries(TOOL_COLORS);

	return (
		<div className="compact-timeline-container">
			{/* Header like TraceTree */}
			<div className="timeline-header">
				<div className="timeline-title-group">
					<span className="timeline-title">Timeline</span>
					<div className="legend-wrapper" ref={legendRef}>
						<button
							className={`legend-btn ${showLegend ? "active" : ""}`}
							onClick={() => setShowLegend(!showLegend)}
							title="Show legend"
						>
							?
						</button>

						{/* Legend popup */}
						{showLegend && (
							<div className="legend-popup">
								<div className="legend-section">
									<div className="legend-section-title">Markers</div>
									<div className="legend-row">
										<span className="legend-marker thinking-legend" />
										<span className="legend-text">Thinking</span>
									</div>
									<div className="legend-row">
										<span className="legend-marker assistant-legend" />
										<span className="legend-text">Assistant</span>
									</div>
									<div className="legend-row">
										<span className="legend-marker final-legend">✓</span>
										<span className="legend-text">Final Response</span>
									</div>
								</div>
								<div className="legend-section">
									<div className="legend-section-title">Tools</div>
									{toolEntries.map(([name, color]) => (
										<div key={name} className="legend-row">
											<span
												className="legend-marker tool-color"
												style={{ background: color }}
											/>
											<span className="legend-text">{name}</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Timeline area with navigation */}
			<div className="timeline-body">
				{/* Left navigation button */}
				<button
					className="nav-btn"
					onClick={() => handleNavClick("left")}
					title="Click: scroll left, Double-click: go to start"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<path d="M15 18l-6-6 6-6" />
					</svg>
				</button>

				{/* Timeline with scroll */}
				<div className="compact-timeline" ref={containerRef}>
					<div className="timeline-track" style={{ width: `${totalWidth}px` }}>
						{turnBlocks.map((block) => {
							const isActive = isTurnActive(block);
							const isSelected = selectedTurnId === block.id;

							return (
								<div
									key={block.id}
									data-turn-block={block.id}
									className={`turn-block ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}`}
									style={{
										left: `${block.xPos}px`,
										width: `${block.width}px`,
									}}
									onClick={(e) => handleTurnClick(block, e)}
									onMouseEnter={() => setHoveredTurnId(block.id)}
									onMouseLeave={() => setHoveredTurnId(null)}
								>
									<span className="turn-label">T{block.turnIndex}</span>

									<div className="markers-container">
										{block.markers.map((marker) => {
											const markerSelected = isMarkerSelected(marker);

											return (
												<div
													key={marker.id}
													data-marker-id={marker.id}
													className={`marker ${marker.type} ${markerSelected ? "selected" : ""}`}
													style={{ left: `${marker.relativeX}%` }}
													onClick={(e) => handleMarkerClick(block, marker, e)}
													title={getMarkerTitle(marker)}
												>
													{marker.type === "finalResponse" && "✓"}
													{marker.type === "tool" && (
														<span
															className="tool-fill"
															style={{
																background: getToolColor(marker.toolName || ""),
															}}
														/>
													)}
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Right navigation button */}
				<button
					className="nav-btn"
					onClick={() => handleNavClick("right")}
					title="Click: scroll right, Double-click: go to end"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<path d="M9 18l6-6-6-6" />
					</svg>
				</button>
			</div>

			<style>{compactTimelineStyles}</style>
		</div>
	);
}

function getMarkerTitle(marker: TurnMarker): string {
	switch (marker.type) {
		case "thinking":
			return "Thinking";
		case "assistant_text":
			return "Assistant Response";
		case "tool":
			return `${marker.toolName} (${marker.duration || 0}ms)`;
		case "finalResponse":
			return "Final Response";
		default:
			return "";
	}
}

const compactTimelineStyles = `
  .compact-timeline-container {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  /* Header */
  .timeline-header {
    position: relative;
    display: flex;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
  }

  .timeline-title-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .timeline-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Legend Wrapper */
  .legend-wrapper {
    position: relative;
  }

  /* Legend Button */
  .legend-btn {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .legend-btn:hover,
  .legend-btn.active {
    background: var(--bg-hover);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  /* Legend Popup */
  .legend-popup {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: var(--space-xs);
    display: flex;
    gap: var(--space-lg);
    padding: var(--space-md);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
  }

  .legend-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 100px;
  }

  .legend-section-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .legend-popup .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-popup .legend-text {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    text-transform: capitalize;
  }

  .legend-popup .legend-marker {
    width: 10px;
    height: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .legend-popup .legend-marker.thinking-legend {
    background: linear-gradient(to right, #a855f7 50%, transparent 50%);
    border: 2px solid #a855f7;
    border-radius: 50%;
  }

  .legend-popup .legend-marker.assistant-legend {
    background: transparent;
    border: 2px solid #10b981;
    border-radius: 50%;
  }

  .legend-popup .legend-marker.tool-color {
    border-radius: 50%;
  }

  .legend-popup .legend-marker.final-legend {
    font-size: 10px;
    color: #22c55e;
    font-weight: bold;
  }

  /* Timeline Body */
  .timeline-body {
    display: flex;
    align-items: center;
    padding: var(--space-sm) var(--space-sm);
    gap: var(--space-sm);
  }

  /* Navigation Buttons - Circle style */
  .nav-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .nav-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  .nav-btn:active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: white;
  }

  .compact-timeline {
    flex: 1;
    display: flex;
    align-items: center;
    height: 56px;
    padding: 8px 4px;
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .compact-timeline.empty {
    justify-content: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .compact-timeline::-webkit-scrollbar {
    height: 4px;
  }

  .compact-timeline::-webkit-scrollbar-track {
    background: transparent;
  }

  .compact-timeline::-webkit-scrollbar-thumb {
    background: var(--border-default);
    border-radius: 2px;
  }

  /* Timeline Track */
  .timeline-track {
    position: relative;
    height: 48px;
    min-width: 100%;
  }

  /* Turn Block */
  .turn-block {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 36px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0 14px;
  }

  .turn-block:hover,
  .turn-block.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .turn-block.selected {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 0 12px rgba(0, 212, 255, 0.15);
  }

  /* Turn Label */
  .turn-label {
    position: absolute;
    top: -10px;
    left: 8px;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted);
    padding: 1px 4px;
    background: var(--bg-secondary);
    border-radius: 3px;
  }

  .turn-block.selected .turn-label,
  .turn-block.active .turn-label {
    color: var(--accent-primary);
  }

  /* Markers Container */
  .markers-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
  }

  /* Marker common styles */
  .marker {
    position: absolute;
    transform: translateX(-50%);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    z-index: 1;
  }

  .marker::before {
    content: '';
    position: absolute;
    top: -6px;
    left: -6px;
    right: -6px;
    bottom: -6px;
  }

  .marker:hover {
    transform: translateX(-50%) scale(1.4);
    z-index: 10;
  }

  .marker.selected {
    transform: translateX(-50%) scale(1.3);
    box-shadow: 0 0 0 3px var(--accent-primary);
    z-index: 10;
  }

  /* Thinking marker (half-filled circle) */
  .marker.thinking {
    width: 10px;
    height: 10px;
    background: linear-gradient(to right, #a855f7 50%, transparent 50%);
    border: 2px solid #a855f7;
    border-radius: 50%;
  }

  /* Tool marker (filled circle with color) */
  .marker.tool {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    overflow: hidden;
  }

  .marker.tool .tool-fill {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  /* Assistant marker (hollow circle) */
  .marker.assistant_text {
    width: 10px;
    height: 10px;
    background: transparent;
    border: 2px solid #10b981;
    border-radius: 50%;
  }

  /* Final Response marker (checkmark) */
  .marker.finalResponse {
    width: 14px;
    height: 14px;
    font-size: 10px;
    font-weight: bold;
    color: #22c55e;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 50%;
  }

  .marker.finalResponse:hover {
    background: rgba(34, 197, 94, 0.25);
  }

  .marker.finalResponse.selected {
    background: rgba(34, 197, 94, 0.3);
  }
`;
