import type { ReactElement } from "react";
import { getToolColor, getToolIcon } from "../constants/tools.ts";
import { formatDurationMs } from "../utils/format.ts";
import { SmartContentRenderer } from "./SmartContentRenderer.tsx";
import type { SelectedItem } from "./TraceTree.tsx";

interface DetailPanelProps {
	selectedItem: SelectedItem | null;
}

interface DetailHeaderProps {
	icon: ReactElement;
	title: string;
	subtitle?: string;
	meta?: string;
	id?: string;
}

function DetailHeader({
	icon,
	title,
	subtitle,
	meta,
	id,
}: DetailHeaderProps): ReactElement {
	return (
		<div className="detail-header">
			{icon}
			<div className="detail-title-section">
				<div className="detail-title">{title}</div>
				<div className="detail-subtitle-row">
					{subtitle && <span className="detail-subtitle">{subtitle}</span>}
					{id && <span className="detail-id">{id}</span>}
				</div>
			</div>
			{meta && <div className="detail-meta">{meta}</div>}
		</div>
	);
}

interface SectionProps {
	title: string;
	badge?: { text: string; variant: string };
	children: React.ReactNode;
}

function Section({ title, badge, children }: SectionProps): ReactElement {
	return (
		<div className="detail-section">
			<div className="section-header">
				<span className="section-title">{title}</span>
				{badge && (
					<span className={`section-badge ${badge.variant}`}>{badge.text}</span>
				)}
			</div>
			{children}
		</div>
	);
}

export function DetailPanel({
	selectedItem,
}: DetailPanelProps): ReactElement | null {
	if (!selectedItem) {
		return (
			<div className="detail-panel">
				<div className="detail-empty">
					<div className="empty-icon">👆</div>
					<div className="empty-text">
						Select an item from the trace tree to view details
					</div>
				</div>
			</div>
		);
	}

	if (selectedItem.type === "prompt" && selectedItem.turn) {
		const turn = selectedItem.turn;
		const toolSteps = turn.steps.filter((s) => s.type === "tool");
		const assistantSteps = turn.steps.filter(
			(s) => s.type === "assistant_text",
		);
		const timestamp = new Date(turn.userPrompt.timestamp).toLocaleString(
			"ko-KR",
		);

		return (
			<div className="detail-panel">
				<DetailHeader
					icon={<div className="detail-icon user-icon">👤</div>}
					title="User Prompt"
					subtitle={timestamp}
					id={turn.id}
					meta={formatDurationMs(turn.endTime - turn.startTime)}
				/>

				<div className="turn-summary-bar">
					<div className="summary-stat">
						<span className="summary-value">{toolSteps.length}</span>
						<span className="summary-label">tools</span>
					</div>
					<div className="summary-stat">
						<span className="summary-value">{assistantSteps.length}</span>
						<span className="summary-label">responses</span>
					</div>
				</div>

				<div className="detail-content">
					<Section
						title="User Message"
						badge={{ text: "Human", variant: "human" }}
					>
						<SmartContentRenderer content={turn.userPrompt.content} />
					</Section>

					{turn.finalResponse && (
						<Section
							title="Final Response"
							badge={{ text: "Complete", variant: "success" }}
						>
							<SmartContentRenderer content={turn.finalResponse.content} />
						</Section>
					)}
				</div>
			</div>
		);
	}

	if (selectedItem.type === "step" && selectedItem.step) {
		const step = selectedItem.step;
		const timestamp = new Date(step.timestamp).toLocaleString("ko-KR");

		if (step.type === "thinking") {
			return (
				<div className="detail-panel">
					<DetailHeader
						icon={<div className="detail-icon thinking-detail-icon">🧠</div>}
						title="Thinking"
						subtitle={timestamp}
						id={step.id}
					/>

					<div className="detail-content">
						<Section
							title="Thinking Content"
							badge={{ text: "Internal", variant: "thinking-badge" }}
						>
							<SmartContentRenderer
								content={step.content}
								className="thinking-renderer"
							/>
						</Section>
					</div>
				</div>
			);
		}

		if (step.type === "assistant_text") {
			return (
				<div className="detail-panel">
					<DetailHeader
						icon={<div className="detail-icon assistant-detail-icon">💬</div>}
						title="Assistant Response"
						subtitle={timestamp}
						id={step.id}
					/>

					<div className="detail-content">
						<Section
							title="Response Content"
							badge={{ text: "Assistant", variant: "assistant-badge" }}
						>
							<SmartContentRenderer content={step.content} />
						</Section>
					</div>
				</div>
			);
		}

		// Tool step
		const toolColor = getToolColor(step.toolName || "");
		const toolTimestamp = new Date(step.timestamp).toLocaleTimeString("ko-KR");

		return (
			<div className="detail-panel">
				<DetailHeader
					icon={
						<div
							className="detail-icon"
							style={{ backgroundColor: `${toolColor}20`, color: toolColor }}
						>
							{getToolIcon(step.toolName || "")}
						</div>
					}
					title={step.toolName || "Tool"}
					subtitle={toolTimestamp}
					id={step.id}
					meta={formatDurationMs(step.toolDuration || 0)}
				/>

				<div className="tool-status-bar">
					<span
						className={`status-indicator ${step.isError ? "error" : "success"}`}
					>
						{step.isError ? "✕ Error" : "✓ Success"}
					</span>
					<span className="status-time">
						{(step.startTime / 1000).toFixed(2)}s
					</span>
				</div>

				<div className="detail-content">
					<Section title="Input">
						<SmartContentRenderer content={step.toolInput || "{}"} />
					</Section>

					{step.toolOutput && (
						<Section
							title="Output"
							badge={{
								text: step.isError ? "Error" : "Result",
								variant: step.isError ? "error" : "success",
							}}
						>
							<SmartContentRenderer content={step.toolOutput} />
						</Section>
					)}
				</div>
			</div>
		);
	}

	if (selectedItem.type === "finalResponse" && selectedItem.finalResponse) {
		const response = selectedItem.finalResponse;
		const timestamp = new Date(response.timestamp).toLocaleString("ko-KR");

		return (
			<div className="detail-panel">
				<DetailHeader
					icon={<div className="detail-icon final-detail-icon">✅</div>}
					title="Final Response"
					subtitle={timestamp}
					id={response.id}
				/>

				<div className="detail-content">
					<Section
						title="Response Content"
						badge={{ text: "Final", variant: "success" }}
					>
						<SmartContentRenderer content={response.content} />
					</Section>
				</div>
			</div>
		);
	}

	return null;
}
