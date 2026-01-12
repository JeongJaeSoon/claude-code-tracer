import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { getToolColor, getToolIcon } from "../constants/tools.ts";
import type {
	AssistantMessage,
	TimelineData,
	TimelineLane,
	Turn,
	TurnStep,
} from "../types/timeline.ts";
import { formatDurationMs } from "../utils/format.ts";

export interface SelectedItem {
	type: "prompt" | "step" | "finalResponse" | "turn";
	turn?: Turn;
	step?: TurnStep;
	finalResponse?: AssistantMessage;
	lane?: TimelineLane;
}

interface TraceTreeProps {
	data: TimelineData;
	maxDuration: number;
	onSelect?: (item: SelectedItem) => void;
	selectedItem?: SelectedItem | null;
}

function getDurationClass(ms: number, maxDuration: number): string {
	const ratio = ms / maxDuration;
	if (ratio < 0.3) return "fast";
	if (ratio < 0.6) return "medium";
	return "slow";
}

function getDurationWidth(ms: number, maxDuration: number): number {
	return Math.max(5, Math.min(100, (ms / maxDuration) * 100));
}

function getTurnToolDuration(turn: Turn): number {
	return turn.steps
		.filter((s) => s.type === "tool")
		.reduce((sum, s) => sum + (s.toolDuration || 0), 0);
}

export function TraceTree({
	data,
	maxDuration,
	onSelect,
	selectedItem,
}: TraceTreeProps): ReactElement {
	const contentRef = useRef<HTMLDivElement>(null);
	const [expandedTurns, setExpandedTurns] = useState<Set<string>>(
		() => new Set(data.lanes.flatMap((lane) => lane.turns.map((t) => t.id))),
	);

	useEffect(() => {
		if (!contentRef.current || !selectedItem) return;

		const turnId = selectedItem.turn?.id;
		const stepId = selectedItem.step?.id;
		const finalResponseId = selectedItem.finalResponse?.id;

		let targetElement: HTMLElement | null = null;

		if (stepId) {
			const selectedStep = contentRef.current.querySelector(
				`[data-turn-id="${turnId}"] .step-item.selected`,
			);
			targetElement =
				(selectedStep as HTMLElement) ||
				contentRef.current.querySelector(
					`[data-turn-id="${turnId}"] .step-item`,
				);
		} else if (finalResponseId) {
			targetElement = contentRef.current.querySelector(
				`[data-turn-id="${turnId}"] .final-response`,
			) as HTMLElement;
		} else if (turnId) {
			targetElement = contentRef.current.querySelector(
				`[data-turn-id="${turnId}"]`,
			) as HTMLElement;
		}

		if (targetElement) {
			const container = contentRef.current;
			const containerRect = container.getBoundingClientRect();
			const targetRect = targetElement.getBoundingClientRect();
			const targetScrollTop =
				container.scrollTop + (targetRect.top - containerRect.top) - 20;

			container.scrollTo({
				top: Math.max(0, targetScrollTop),
				behavior: "smooth",
			});
		}
	}, [selectedItem]);

	const { mainLane, subAgentLanes } = useMemo(() => {
		const main = data.lanes.find((l) => l.id === "main") || data.lanes[0];
		const subAgents = data.lanes.filter(
			(l) => l.id !== "main" && l.id !== main?.id,
		);
		return { mainLane: main, subAgentLanes: subAgents };
	}, [data.lanes]);

	const allTurnIds = useMemo(
		() => data.lanes.flatMap((lane) => lane.turns.map((t) => t.id)),
		[data.lanes],
	);

	const allExpanded =
		allTurnIds.length > 0 && allTurnIds.every((id) => expandedTurns.has(id));

	function toggleTurn(turnId: string): void {
		setExpandedTurns((prev) => {
			const next = new Set(prev);
			if (next.has(turnId)) {
				next.delete(turnId);
			} else {
				next.add(turnId);
			}
			return next;
		});
	}

	function toggleAllExpanded(): void {
		setExpandedTurns(allExpanded ? new Set() : new Set(allTurnIds));
	}

	function isItemSelected(type: string, id: string): boolean {
		if (!selectedItem) return false;

		switch (type) {
			case "prompt":
				return selectedItem.type === "prompt" && selectedItem.turn?.id === id;
			case "step":
				return selectedItem.type === "step" && selectedItem.step?.id === id;
			case "finalResponse":
				return (
					selectedItem.type === "finalResponse" &&
					selectedItem.finalResponse?.id === id
				);
			default:
				return false;
		}
	}

	function renderStep(
		step: TurnStep,
		turn: Turn,
		lane: TimelineLane,
	): ReactElement {
		const isSelected = isItemSelected("step", step.id);
		const handleClick = (e: React.MouseEvent): void => {
			e.stopPropagation();
			onSelect?.({ type: "step", step, turn, lane });
		};

		if (step.type === "thinking") {
			return (
				<div
					key={step.id}
					className={`step-item thinking-step ${isSelected ? "selected" : ""}`}
					onClick={handleClick}
				>
					<div className="step-icon thinking-icon">🧠</div>
					<div className="step-content">
						<div className="step-type thinking-label">Thinking</div>
						<div className="step-text">{step.content}</div>
					</div>
				</div>
			);
		}

		if (step.type === "assistant_text") {
			return (
				<div
					key={step.id}
					className={`step-item assistant-step ${isSelected ? "selected" : ""}`}
					onClick={handleClick}
				>
					<div className="step-icon assistant-icon">💬</div>
					<div className="step-content">
						<div className="step-type">Assistant</div>
						<div className="step-text">{step.content}</div>
					</div>
				</div>
			);
		}

		const toolColor = getToolColor(step.toolName || "");
		return (
			<div
				key={step.id}
				className={`step-item tool-step ${step.isError ? "error" : ""} ${isSelected ? "selected" : ""}`}
				onClick={handleClick}
			>
				<div
					className="step-icon tool-icon"
					style={{ backgroundColor: `${toolColor}20`, color: toolColor }}
				>
					{getToolIcon(step.toolName || "")}
				</div>
				<div className="step-content">
					<div className="step-name">{step.toolName}</div>
					<div className="step-input">{step.toolInput || "-"}</div>
				</div>
				<div className="step-duration">
					{formatDurationMs(step.toolDuration || 0)}
				</div>
			</div>
		);
	}

	function renderTurn(turn: Turn, lane: TimelineLane): ReactElement {
		const isExpanded = expandedTurns.has(turn.id);
		const toolDuration = getTurnToolDuration(turn);
		const assistantSteps = turn.steps.filter(
			(s) => s.type === "assistant_text",
		);
		const toolSteps = turn.steps.filter((s) => s.type === "tool");

		return (
			<div key={turn.id} data-turn-id={turn.id} className="turn-section">
				<div
					className={`turn-header ${isItemSelected("prompt", turn.id) ? "selected" : ""}`}
					onClick={() => onSelect?.({ type: "prompt", turn, lane })}
				>
					<div
						className={`turn-toggle ${isExpanded ? "expanded" : ""}`}
						onClick={(e) => {
							e.stopPropagation();
							toggleTurn(turn.id);
						}}
					>
						▶
					</div>
					<div className="turn-icon">👤</div>
					<div className="turn-content">
						<div className="turn-text">{turn.userPrompt.content}</div>
						<div className="turn-meta">
							<span>{toolSteps.length} tools</span>
							{assistantSteps.length > 0 && (
								<span className="assistant-count">
									{assistantSteps.length} responses
								</span>
							)}
						</div>
					</div>
					<div className="duration-bar-container">
						<div className="duration-value">
							{formatDurationMs(toolDuration)}
						</div>
						<div className="duration-bar">
							<div
								className={`duration-bar-fill ${getDurationClass(toolDuration, maxDuration)}`}
								style={{
									width: `${getDurationWidth(toolDuration, maxDuration)}%`,
								}}
							/>
						</div>
					</div>
				</div>

				{isExpanded && (
					<div className="steps-list">
						{turn.steps.map((step) => renderStep(step, turn, lane))}

						{turn.finalResponse && (
							<div
								className={`step-item final-response ${isItemSelected("finalResponse", turn.finalResponse.id) ? "selected" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
									onSelect?.({
										type: "finalResponse",
										finalResponse: turn.finalResponse!,
										turn,
										lane,
									});
								}}
							>
								<div className="step-icon final-icon">✅</div>
								<div className="step-content">
									<div className="step-type final-label">Final Response</div>
									<div className="step-text final-text">
										{turn.finalResponse.content}
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="trace-tree-container">
			<div className="trace-tree-header">
				<span className="trace-tree-title">Trace Tree</span>
				<button
					className="expand-toggle-btn"
					onClick={toggleAllExpanded}
					title={allExpanded ? "Collapse All" : "Expand All"}
				>
					{allExpanded ? "⊟" : "⊞"}
				</button>
			</div>

			<div className="trace-tree-content" ref={contentRef}>
				{!mainLane || mainLane.turns.length === 0 ? (
					<div className="empty-state">
						<div className="empty-icon">📋</div>
						<div className="empty-text">No turns found</div>
					</div>
				) : (
					<>
						<div className="lane-section">
							<div className="lane-header">
								<div className="lane-icon main">●</div>
								<div className="lane-name">{mainLane.name}</div>
								<div className="lane-turn-count">
									{mainLane.turns.length} turns
								</div>
							</div>
							{mainLane.turns.map((turn) => renderTurn(turn, mainLane))}
						</div>

						{subAgentLanes.map((lane) => (
							<div key={lane.id} className="lane-section subagent-lane">
								<div className="lane-header subagent">
									<div className="lane-icon subagent">🤖</div>
									<div className="lane-name">{lane.name}</div>
									<div className="lane-turn-count">
										{lane.turns.length} turns
									</div>
								</div>
								{lane.turns.map((turn) => renderTurn(turn, lane))}
							</div>
						))}
					</>
				)}
			</div>
		</div>
	);
}
