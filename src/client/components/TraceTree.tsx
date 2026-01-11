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
						<div className="turn-text">"{turn.userPrompt.content}"</div>
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

			<style>{`
        .trace-tree-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
          border-right: 1px solid var(--border-subtle);
        }

        /* Header - matches Timeline style */
        .trace-tree-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-sm) var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }

        .trace-tree-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .expand-toggle-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .expand-toggle-btn:hover {
          background: var(--bg-hover);
          color: var(--text-secondary);
          border-color: var(--border-default);
        }

        .trace-tree-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-md);
        }

        .trace-tree-content::-webkit-scrollbar {
          width: 8px;
        }

        .trace-tree-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .trace-tree-content::-webkit-scrollbar-thumb {
          background: var(--border-default);
          border-radius: 4px;
        }

        /* Lane Section */
        .lane-section {
          margin-bottom: var(--space-lg);
        }

        .lane-header {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-xs) var(--space-sm);
          margin-bottom: var(--space-sm);
          font-size: 12px;
          color: var(--text-muted);
        }

        .lane-icon {
          font-size: 10px;
        }

        .lane-icon.main {
          color: #8b5cf6;
        }

        .lane-icon.subagent {
          font-size: 12px;
        }

        .lane-name {
          font-weight: 600;
          color: var(--text-secondary);
        }

        .lane-turn-count {
          font-size: 11px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .subagent-lane {
          margin-left: var(--space-lg);
          padding-left: var(--space-md);
          border-left: 2px solid #a855f7;
        }

        .lane-header.subagent .lane-name {
          color: #a855f7;
        }

        /* Turn Section */
        .turn-section {
          margin-bottom: var(--space-md);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .turn-header {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid var(--border-subtle);
          position: relative;
          overflow: hidden;
        }

        .turn-header::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: var(--accent-primary);
        }

        .turn-header:hover {
          background: var(--bg-hover);
          border-color: var(--border-default);
        }

        .turn-header.selected {
          background: var(--bg-active);
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.2), 0 0 20px rgba(0, 212, 255, 0.1);
        }

        .turn-toggle {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: transform 0.2s ease;
          font-size: 12px;
        }

        .turn-toggle.expanded {
          transform: rotate(90deg);
        }

        .turn-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.15);
          border-radius: var(--radius-sm);
          font-size: 12px;
        }

        .turn-content {
          flex: 1;
          min-width: 0;
        }

        .turn-text {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .turn-meta {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          margin-top: 2px;
        }

        .turn-meta span {
          font-size: 11px;
          color: var(--text-muted);
        }

        .assistant-count {
          color: #10b981 !important;
        }

        /* Duration Bar */
        .duration-bar-container {
          width: 80px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }

        .duration-value {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .duration-bar {
          width: 100%;
          height: 4px;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }

        .duration-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .duration-bar-fill.fast {
          background: linear-gradient(90deg, #10b981, #34d399);
        }

        .duration-bar-fill.medium {
          background: linear-gradient(90deg, #eab308, #fbbf24);
        }

        .duration-bar-fill.slow {
          background: linear-gradient(90deg, #f97316, #fb923c);
        }

        /* Steps List */
        .steps-list {
          margin-left: var(--space-lg);
          padding-left: var(--space-md);
          border-left: 1px solid var(--border-subtle);
          margin-top: var(--space-xs);
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          margin: var(--space-xs) 0;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }

        .step-item::before {
          content: '';
          position: absolute;
          left: calc(-1 * var(--space-md) - 1px);
          top: 50%;
          width: var(--space-md);
          height: 1px;
          background: var(--border-subtle);
        }

        .step-item:hover {
          background: var(--bg-hover);
        }

        .step-item.selected {
          background: var(--bg-active);
          box-shadow: inset 0 0 0 1px var(--border-default);
        }

        .step-item.error::before {
          background: #ef4444;
        }

        .step-item.error {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Thinking Step */
        .thinking-step {
          background: rgba(168, 85, 247, 0.05);
          border-left: 2px solid #a855f7;
        }

        .thinking-icon {
          width: 22px;
          height: 22px;
          background: rgba(168, 85, 247, 0.15);
          color: #a855f7;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          flex-shrink: 0;
        }

        .thinking-label {
          color: #a855f7 !important;
        }

        /* Assistant Step */
        .assistant-step {
          background: rgba(16, 185, 129, 0.05);
          border-left: 2px solid #10b981;
        }

        .assistant-icon {
          width: 22px;
          height: 22px;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          flex-shrink: 0;
        }

        /* Tool Step */
        .tool-step .step-icon {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-mono);
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .step-type {
          font-size: 11px;
          font-weight: 600;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .step-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .step-text {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .step-input {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }

        .step-duration {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;
          align-self: center;
        }

        /* Final Response */
        .final-response {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.3);
          margin-top: var(--space-sm);
        }

        .final-response::before {
          background: #22c55e;
          width: 2px;
        }

        .final-icon {
          width: 22px;
          height: 22px;
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          flex-shrink: 0;
        }

        .final-label {
          color: #22c55e !important;
          font-weight: 700;
        }

        .final-text {
          font-size: 12px;
          color: var(--text-primary);
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--text-muted);
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: var(--space-md);
          opacity: 0.3;
        }

        .empty-text {
          font-size: 14px;
        }
      `}</style>
		</div>
	);
}
