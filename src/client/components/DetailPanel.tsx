import { useState, type ReactElement } from "react";
import { getToolIcon, getToolColor } from "../constants/tools.ts";
import { SmartContentRenderer } from "./SmartContentRenderer.tsx";
import { formatDurationMs } from "../utils/format.ts";
import type { SelectedItem } from "./TraceTree.tsx";

interface DetailPanelProps {
	selectedItem: SelectedItem | null;
}

type TabType = "run" | "input" | "output" | "metadata";

interface TabConfig {
	id: TabType;
	label: string;
}

const BASIC_TABS: TabConfig[] = [
	{ id: "run", label: "Run" },
	{ id: "metadata", label: "Metadata" },
];

const TOOL_TABS: TabConfig[] = [
	{ id: "run", label: "Run" },
	{ id: "input", label: "Input" },
	{ id: "output", label: "Output" },
	{ id: "metadata", label: "Metadata" },
];

interface TabButtonsProps {
	tabs: TabConfig[];
	activeTab: TabType;
	onTabChange: (tab: TabType) => void;
}

function TabButtons({
	tabs,
	activeTab,
	onTabChange,
}: TabButtonsProps): ReactElement {
	return (
		<div className="detail-tabs">
			{tabs.map((tab) => (
				<button
					key={tab.id}
					className={`detail-tab ${activeTab === tab.id ? "active" : ""}`}
					onClick={() => onTabChange(tab.id)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

interface DetailHeaderProps {
	icon: ReactElement;
	title: string;
	subtitle?: string;
	meta?: string;
}

function DetailHeader({
	icon,
	title,
	subtitle,
	meta,
}: DetailHeaderProps): ReactElement {
	return (
		<div className="detail-header">
			{icon}
			<div className="detail-title-section">
				<div className="detail-title">{title}</div>
				{subtitle && <div className="detail-subtitle">{subtitle}</div>}
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

function formatMetadata(data: Record<string, unknown>): string {
	return JSON.stringify(data, null, 2);
}

export function DetailPanel({
	selectedItem,
}: DetailPanelProps): ReactElement | null {
	const [activeTab, setActiveTab] = useState<TabType>("run");

	if (!selectedItem) {
		return (
			<div className="detail-panel">
				<div className="detail-empty">
					<div className="empty-icon">👆</div>
					<div className="empty-text">
						Select an item from the trace tree to view details
					</div>
				</div>
				<style>{detailPanelStyles}</style>
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
				/>
				<TabButtons
					tabs={BASIC_TABS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>

				<div className="detail-content">
					{activeTab === "run" && (
						<>
							<Section
								title="User Message"
								badge={{ text: "Human", variant: "human" }}
							>
								<SmartContentRenderer content={turn.userPrompt.content} />
							</Section>

							<Section title="Turn Summary">
								<div className="section-content">
									<div className="summary-grid">
										<div className="summary-item">
											<span className="summary-label">Tools</span>
											<span className="summary-value">{toolSteps.length}</span>
										</div>
										<div className="summary-item">
											<span className="summary-label">Responses</span>
											<span className="summary-value">
												{assistantSteps.length}
											</span>
										</div>
										<div className="summary-item">
											<span className="summary-label">Duration</span>
											<span className="summary-value">
												{formatDurationMs(turn.endTime - turn.startTime)}
											</span>
										</div>
									</div>
								</div>
							</Section>

							{turn.finalResponse && (
								<Section
									title="Final Response"
									badge={{ text: "Complete", variant: "success" }}
								>
									<SmartContentRenderer content={turn.finalResponse.content} />
								</Section>
							)}
						</>
					)}

					{activeTab === "metadata" && (
						<Section title="Metadata">
							<SmartContentRenderer
								content={formatMetadata({
									id: turn.id,
									startTime: `${(turn.startTime / 1000).toFixed(2)}s`,
									endTime: `${(turn.endTime / 1000).toFixed(2)}s`,
									toolCount: turn.toolCount,
									promptTimestamp: turn.userPrompt.timestamp,
								})}
								forceType="json"
							/>
						</Section>
					)}
				</div>

				<style>{detailPanelStyles}</style>
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
					/>
					<TabButtons
						tabs={BASIC_TABS}
						activeTab={activeTab}
						onTabChange={setActiveTab}
					/>

					<div className="detail-content">
						{activeTab === "run" && (
							<Section
								title="Thinking Content"
								badge={{ text: "Internal", variant: "thinking-badge" }}
							>
								<SmartContentRenderer
									content={step.content}
									className="thinking-renderer"
								/>
							</Section>
						)}

						{activeTab === "metadata" && (
							<Section title="Metadata">
								<SmartContentRenderer
									content={formatMetadata({
										id: step.id,
										type: step.type,
										startTime: `${(step.startTime / 1000).toFixed(2)}s`,
										timestamp: step.timestamp,
									})}
									forceType="json"
								/>
							</Section>
						)}
					</div>

					<style>{detailPanelStyles}</style>
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
					/>
					<TabButtons
						tabs={BASIC_TABS}
						activeTab={activeTab}
						onTabChange={setActiveTab}
					/>

					<div className="detail-content">
						{activeTab === "run" && (
							<Section
								title="Response Content"
								badge={{ text: "Assistant", variant: "assistant-badge" }}
							>
								<SmartContentRenderer content={step.content} />
							</Section>
						)}

						{activeTab === "metadata" && (
							<Section title="Metadata">
								<SmartContentRenderer
									content={formatMetadata({
										id: step.id,
										type: step.type,
										startTime: `${(step.startTime / 1000).toFixed(2)}s`,
										timestamp: step.timestamp,
									})}
									forceType="json"
								/>
							</Section>
						)}
					</div>

					<style>{detailPanelStyles}</style>
				</div>
			);
		}

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
					meta={`${formatDurationMs(step.toolDuration || 0)} · ${toolTimestamp}`}
				/>
				<TabButtons
					tabs={TOOL_TABS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>

				<div className="detail-content">
					{activeTab === "run" && (
						<>
							<Section title="Input">
								<SmartContentRenderer
									content={step.toolInput || "{}"}
									forceType="json"
								/>
							</Section>

							{step.toolOutput && (
								<Section title="Output Preview">
									<SmartContentRenderer
										content={
											step.toolOutput.length > 2000
												? step.toolOutput.slice(0, 2000) + "\n... (truncated)"
												: step.toolOutput
										}
									/>
								</Section>
							)}

							<Section
								title="Status"
								badge={{
									text: step.isError ? "Error" : "Success",
									variant: step.isError ? "error" : "success",
								}}
							>
								<div className="section-content">
									<div className="status-info">
										<div className="status-row">
											<span className="status-label">Duration</span>
											<span className="status-value">
												{formatDurationMs(step.toolDuration || 0)}
											</span>
										</div>
										<div className="status-row">
											<span className="status-label">Start Time</span>
											<span className="status-value">
												{(step.startTime / 1000).toFixed(2)}s
											</span>
										</div>
									</div>
								</div>
							</Section>
						</>
					)}

					{activeTab === "input" && (
						<Section title="Tool Input">
							<SmartContentRenderer
								content={step.toolInput || "{}"}
								forceType="json"
							/>
						</Section>
					)}

					{activeTab === "output" && (
						<Section
							title="Tool Output"
							badge={{
								text: step.isError ? "Error" : "Result",
								variant: step.isError ? "error" : "success",
							}}
						>
							{step.toolOutput ? (
								<SmartContentRenderer content={step.toolOutput} />
							) : (
								<div className="section-content">
									<div className="empty-output">No output recorded</div>
								</div>
							)}
						</Section>
					)}

					{activeTab === "metadata" && (
						<Section title="Metadata">
							<SmartContentRenderer
								content={formatMetadata({
									id: step.id,
									type: step.type,
									toolName: step.toolName,
									duration: `${step.toolDuration}ms`,
									startTime: `${(step.startTime / 1000).toFixed(2)}s`,
									isError: step.isError,
									timestamp: step.timestamp,
								})}
								forceType="json"
							/>
						</Section>
					)}
				</div>

				<style>{detailPanelStyles}</style>
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
				/>
				<TabButtons
					tabs={BASIC_TABS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>

				<div className="detail-content">
					{activeTab === "run" && (
						<Section
							title="Response Content"
							badge={{ text: "Final", variant: "success" }}
						>
							<SmartContentRenderer content={response.content} />
						</Section>
					)}

					{activeTab === "metadata" && (
						<Section title="Metadata">
							<SmartContentRenderer
								content={formatMetadata({
									id: response.id,
									timestamp: response.timestamp,
								})}
								forceType="json"
							/>
						</Section>
					)}
				</div>

				<style>{detailPanelStyles}</style>
			</div>
		);
	}

	return null;
}

const detailPanelStyles = `
  .detail-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    min-width: 400px;
  }

  .detail-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-xl);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-md);
    opacity: 0.5;
  }

  .empty-text {
    font-size: 14px;
    max-width: 200px;
  }

  .detail-header {
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .detail-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .user-icon {
    background: rgba(59, 130, 246, 0.15);
    font-size: 18px;
  }

  .thinking-detail-icon {
    background: rgba(168, 85, 247, 0.15);
    font-size: 18px;
  }

  .assistant-detail-icon {
    background: rgba(16, 185, 129, 0.15);
    font-size: 18px;
  }

  .final-detail-icon {
    background: rgba(34, 197, 94, 0.2);
    font-size: 18px;
  }

  .detail-title-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .detail-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .detail-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .detail-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-subtle);
    padding: 0 var(--space-lg);
    background: var(--bg-elevated);
  }

  .detail-tab {
    padding: var(--space-sm) var(--space-md);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    background: transparent;
    border-top: none;
    border-left: none;
    border-right: none;
  }

  .detail-tab:hover {
    color: var(--text-secondary);
  }

  .detail-tab.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
  }

  .detail-section {
    margin-bottom: var(--space-md);
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .section-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
  }

  .section-badge.human {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .section-badge.assistant-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .section-badge.success {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .section-badge.error {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .section-badge.thinking-badge {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .section-content {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }

  .final-response-content {
    border-color: rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.05);
  }

  .thinking-content {
    border-color: rgba(168, 85, 247, 0.3);
    background: rgba(168, 85, 247, 0.05);
  }

  .output-preview {
    max-height: 150px;
    overflow-y: auto;
  }

  .empty-output {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }

  .message-content {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .code-block {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-sm);
  }

  .summary-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-value {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-top: 4px;
  }

  .status-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .status-row {
    display: flex;
    justify-content: space-between;
  }

  .status-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .status-value {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }
`;
