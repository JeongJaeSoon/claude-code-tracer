import { useState } from "react";
import { getToolIcon, getToolColor } from "../constants/tools.ts";
import { SmartContentRenderer } from "./SmartContentRenderer.tsx";
import type { SelectedItem } from "./TraceTree.tsx";

interface DetailPanelProps {
  selectedItem: SelectedItem | null;
}

type TabType = "run" | "input" | "output" | "metadata";

export function DetailPanel({ selectedItem }: DetailPanelProps): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<TabType>("run");

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  // Empty state
  if (!selectedItem) {
    return (
      <div className="detail-panel">
        <div className="detail-empty">
          <div className="empty-icon">👆</div>
          <div className="empty-text">Select an item from the trace tree to view details</div>
        </div>

        <style>{detailPanelStyles}</style>
      </div>
    );
  }

  // User Prompt selected (Turn header)
  if (selectedItem.type === "prompt" && selectedItem.turn) {
    const turn = selectedItem.turn;
    const toolSteps = turn.steps.filter(s => s.type === "tool");
    const assistantSteps = turn.steps.filter(s => s.type === "assistant_text");

    return (
      <div className="detail-panel">
        <div className="detail-header">
          <div className="detail-icon user-icon">👤</div>
          <div className="detail-title-section">
            <div className="detail-title">User Prompt</div>
            <div className="detail-subtitle">
              {new Date(turn.userPrompt.timestamp).toLocaleString("ko-KR")}
            </div>
          </div>
        </div>

        <div className="detail-tabs">
          <button
            className={`detail-tab ${activeTab === "run" ? "active" : ""}`}
            onClick={() => setActiveTab("run")}
          >
            Run
          </button>
          <button
            className={`detail-tab ${activeTab === "metadata" ? "active" : ""}`}
            onClick={() => setActiveTab("metadata")}
          >
            Metadata
          </button>
        </div>

        <div className="detail-content">
          {activeTab === "run" && (
            <>
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">User Message</span>
                  <span className="section-badge human">Human</span>
                </div>
                <SmartContentRenderer content={turn.userPrompt.content} />
              </div>

              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Turn Summary</span>
                </div>
                <div className="section-content">
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Tools</span>
                      <span className="summary-value">{toolSteps.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Responses</span>
                      <span className="summary-value">{assistantSteps.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Duration</span>
                      <span className="summary-value">{formatDuration(turn.endTime - turn.startTime)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {turn.finalResponse && (
                <div className="detail-section">
                  <div className="section-header">
                    <span className="section-title">Final Response</span>
                    <span className="section-badge success">Complete</span>
                  </div>
                  <SmartContentRenderer content={turn.finalResponse.content} />
                </div>
              )}
            </>
          )}

          {activeTab === "metadata" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Metadata</span>
              </div>
              <SmartContentRenderer
                content={JSON.stringify(
                  {
                    id: turn.id,
                    startTime: `${(turn.startTime / 1000).toFixed(2)}s`,
                    endTime: `${(turn.endTime / 1000).toFixed(2)}s`,
                    toolCount: turn.toolCount,
                    promptTimestamp: turn.userPrompt.timestamp,
                  },
                  null,
                  2
                )}
                forceType="json"
              />
            </div>
          )}
        </div>

        <style>{detailPanelStyles}</style>
      </div>
    );
  }

  // Step selected (Thinking, Assistant text, or Tool)
  if (selectedItem.type === "step" && selectedItem.step) {
    const step = selectedItem.step;

    // Thinking step
    if (step.type === "thinking") {
      return (
        <div className="detail-panel">
          <div className="detail-header">
            <div className="detail-icon thinking-detail-icon">🧠</div>
            <div className="detail-title-section">
              <div className="detail-title">Thinking</div>
              <div className="detail-subtitle">
                {new Date(step.timestamp).toLocaleString("ko-KR")}
              </div>
            </div>
          </div>

          <div className="detail-tabs">
            <button
              className={`detail-tab ${activeTab === "run" ? "active" : ""}`}
              onClick={() => setActiveTab("run")}
            >
              Run
            </button>
            <button
              className={`detail-tab ${activeTab === "metadata" ? "active" : ""}`}
              onClick={() => setActiveTab("metadata")}
            >
              Metadata
            </button>
          </div>

          <div className="detail-content">
            {activeTab === "run" && (
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Thinking Content</span>
                  <span className="section-badge thinking-badge">Internal</span>
                </div>
                <SmartContentRenderer content={step.content} className="thinking-renderer" />
              </div>
            )}

            {activeTab === "metadata" && (
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Metadata</span>
                </div>
                <SmartContentRenderer
                  content={JSON.stringify(
                    {
                      id: step.id,
                      type: step.type,
                      startTime: `${(step.startTime / 1000).toFixed(2)}s`,
                      timestamp: step.timestamp,
                    },
                    null,
                    2
                  )}
                  forceType="json"
                />
              </div>
            )}
          </div>

          <style>{detailPanelStyles}</style>
        </div>
      );
    }

    if (step.type === "assistant_text") {
      return (
        <div className="detail-panel">
          <div className="detail-header">
            <div className="detail-icon assistant-detail-icon">💬</div>
            <div className="detail-title-section">
              <div className="detail-title">Assistant Response</div>
              <div className="detail-subtitle">
                {new Date(step.timestamp).toLocaleString("ko-KR")}
              </div>
            </div>
          </div>

          <div className="detail-tabs">
            <button
              className={`detail-tab ${activeTab === "run" ? "active" : ""}`}
              onClick={() => setActiveTab("run")}
            >
              Run
            </button>
            <button
              className={`detail-tab ${activeTab === "metadata" ? "active" : ""}`}
              onClick={() => setActiveTab("metadata")}
            >
              Metadata
            </button>
          </div>

          <div className="detail-content">
            {activeTab === "run" && (
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Response Content</span>
                  <span className="section-badge assistant-badge">Assistant</span>
                </div>
                <SmartContentRenderer content={step.content} />
              </div>
            )}

            {activeTab === "metadata" && (
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Metadata</span>
                </div>
                <SmartContentRenderer
                  content={JSON.stringify(
                    {
                      id: step.id,
                      type: step.type,
                      startTime: `${(step.startTime / 1000).toFixed(2)}s`,
                      timestamp: step.timestamp,
                    },
                    null,
                    2
                  )}
                  forceType="json"
                />
              </div>
            )}
          </div>

          <style>{detailPanelStyles}</style>
        </div>
      );
    }

    // Tool step
    const toolColor = getToolColor(step.toolName || "");

    return (
      <div className="detail-panel">
        <div className="detail-header">
          <div
            className="detail-icon"
            style={{
              backgroundColor: `${toolColor}20`,
              color: toolColor,
            }}
          >
            {getToolIcon(step.toolName || "")}
          </div>
          <div className="detail-title">{step.toolName}</div>
          <div className="detail-meta">
            {formatDuration(step.toolDuration || 0)} · {new Date(step.timestamp).toLocaleTimeString("ko-KR")}
          </div>
        </div>

        <div className="detail-tabs">
          <button
            className={`detail-tab ${activeTab === "run" ? "active" : ""}`}
            onClick={() => setActiveTab("run")}
          >
            Run
          </button>
          <button
            className={`detail-tab ${activeTab === "input" ? "active" : ""}`}
            onClick={() => setActiveTab("input")}
          >
            Input
          </button>
          <button
            className={`detail-tab ${activeTab === "output" ? "active" : ""}`}
            onClick={() => setActiveTab("output")}
          >
            Output
          </button>
          <button
            className={`detail-tab ${activeTab === "metadata" ? "active" : ""}`}
            onClick={() => setActiveTab("metadata")}
          >
            Metadata
          </button>
        </div>

        <div className="detail-content">
          {activeTab === "run" && (
            <>
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Input</span>
                </div>
                <SmartContentRenderer content={step.toolInput || "{}"} forceType="json" />
              </div>

              {step.toolOutput && (
                <div className="detail-section">
                  <div className="section-header">
                    <span className="section-title">Output Preview</span>
                  </div>
                  <SmartContentRenderer
                    content={step.toolOutput.length > 2000 ? step.toolOutput.slice(0, 2000) + "\n... (truncated)" : step.toolOutput}
                  />
                </div>
              )}

              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Status</span>
                  <span className={`section-badge ${step.isError ? "error" : "success"}`}>
                    {step.isError ? "Error" : "Success"}
                  </span>
                </div>
                <div className="section-content">
                  <div className="status-info">
                    <div className="status-row">
                      <span className="status-label">Duration</span>
                      <span className="status-value">{formatDuration(step.toolDuration || 0)}</span>
                    </div>
                    <div className="status-row">
                      <span className="status-label">Start Time</span>
                      <span className="status-value">{(step.startTime / 1000).toFixed(2)}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "input" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Tool Input</span>
              </div>
              <SmartContentRenderer content={step.toolInput || "{}"} forceType="json" />
            </div>
          )}

          {activeTab === "output" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Tool Output</span>
                <span className={`section-badge ${step.isError ? "error" : "success"}`}>
                  {step.isError ? "Error" : "Result"}
                </span>
              </div>
              {step.toolOutput ? (
                <SmartContentRenderer content={step.toolOutput} />
              ) : (
                <div className="section-content">
                  <div className="empty-output">No output recorded</div>
                </div>
              )}
            </div>
          )}

          {activeTab === "metadata" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Metadata</span>
              </div>
              <SmartContentRenderer
                content={JSON.stringify(
                  {
                    id: step.id,
                    type: step.type,
                    toolName: step.toolName,
                    duration: `${step.toolDuration}ms`,
                    startTime: `${(step.startTime / 1000).toFixed(2)}s`,
                    isError: step.isError,
                    timestamp: step.timestamp,
                  },
                  null,
                  2
                )}
                forceType="json"
              />
            </div>
          )}
        </div>

        <style>{detailPanelStyles}</style>
      </div>
    );
  }

  // Final Response selected
  if (selectedItem.type === "finalResponse" && selectedItem.finalResponse) {
    const response = selectedItem.finalResponse;
    return (
      <div className="detail-panel">
        <div className="detail-header">
          <div className="detail-icon final-detail-icon">✅</div>
          <div className="detail-title-section">
            <div className="detail-title">Final Response</div>
            <div className="detail-subtitle">
              {new Date(response.timestamp).toLocaleString("ko-KR")}
            </div>
          </div>
        </div>

        <div className="detail-tabs">
          <button
            className={`detail-tab ${activeTab === "run" ? "active" : ""}`}
            onClick={() => setActiveTab("run")}
          >
            Run
          </button>
          <button
            className={`detail-tab ${activeTab === "metadata" ? "active" : ""}`}
            onClick={() => setActiveTab("metadata")}
          >
            Metadata
          </button>
        </div>

        <div className="detail-content">
          {activeTab === "run" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Response Content</span>
                <span className="section-badge success">Final</span>
              </div>
              <SmartContentRenderer content={response.content} />
            </div>
          )}

          {activeTab === "metadata" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Metadata</span>
              </div>
              <SmartContentRenderer
                content={JSON.stringify(
                  {
                    id: response.id,
                    timestamp: response.timestamp,
                  },
                  null,
                  2
                )}
                forceType="json"
              />
            </div>
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

  .detail-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
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
