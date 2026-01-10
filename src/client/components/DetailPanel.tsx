import { useState } from "react";
import { getToolIcon, getToolColor } from "../constants/tools.ts";
import type { SelectedItem } from "./TraceTree.tsx";

interface DetailPanelProps {
  selectedItem: SelectedItem | null;
}

type TabType = "run" | "input" | "output" | "metadata";

export function DetailPanel({ selectedItem }: DetailPanelProps): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<TabType>("run");
  const [showJson, setShowJson] = useState(false);

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatJson(input: string | null | undefined): string {
    if (!input) return "null";
    try {
      return JSON.stringify(JSON.parse(input), null, 2);
    } catch {
      return input;
    }
  }

  function getInputSummary(input: string | null | undefined): Record<string, unknown> | string {
    if (!input) return "-";
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
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
                <div className="section-content">
                  <div className="message-content">{turn.userPrompt.content}</div>
                </div>
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
                  <div className="section-content final-response-content">
                    <div className="message-content">{turn.finalResponse.content}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "metadata" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Metadata</span>
              </div>
              <div className="section-content">
                <div className="code-block">
                  {JSON.stringify(
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
                </div>
              </div>
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
                <div className="section-content thinking-content">
                  <div className="message-content">{step.content}</div>
                </div>
              </div>
            )}

            {activeTab === "metadata" && (
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Metadata</span>
                </div>
                <div className="section-content">
                  <div className="code-block">
                    {JSON.stringify(
                      {
                        id: step.id,
                        type: step.type,
                        startTime: `${(step.startTime / 1000).toFixed(2)}s`,
                        timestamp: step.timestamp,
                      },
                      null,
                      2
                    )}
                  </div>
                </div>
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
                <div className="section-content">
                  <div className="message-content">{step.content}</div>
                </div>
              </div>
            )}

            {activeTab === "metadata" && (
              <div className="detail-section">
                <div className="section-header">
                  <span className="section-title">Metadata</span>
                </div>
                <div className="section-content">
                  <div className="code-block">
                    {JSON.stringify(
                      {
                        id: step.id,
                        type: step.type,
                        startTime: `${(step.startTime / 1000).toFixed(2)}s`,
                        timestamp: step.timestamp,
                      },
                      null,
                      2
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <style>{detailPanelStyles}</style>
        </div>
      );
    }

    // Tool step
    const toolColor = getToolColor(step.toolName || "");
    const inputData = getInputSummary(step.toolInput);

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
          <div className="detail-title-section">
            <div className="detail-title">{step.toolName}</div>
            <div className="detail-subtitle">
              {formatDuration(step.toolDuration || 0)} · {new Date(step.timestamp).toLocaleTimeString("ko-KR")}
            </div>
          </div>
          <label className="json-toggle">
            <span>JSON</span>
            <input
              type="checkbox"
              checked={showJson}
              onChange={(e) => setShowJson(e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb"></span>
            </span>
          </label>
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
                <div className="section-content">
                  {showJson ? (
                    <div className="code-block">{formatJson(step.toolInput)}</div>
                  ) : (
                    <div className="input-summary">
                      {typeof inputData === "object" ? (
                        Object.entries(inputData).map(([key, value]) => (
                          <div key={key} className="input-row">
                            <span className="input-key">{key}:</span>
                            <span className="input-value">
                              {typeof value === "string"
                                ? value.length > 100
                                  ? value.slice(0, 100) + "..."
                                  : value
                                : JSON.stringify(value)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="input-value">{String(inputData)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {step.toolOutput && (
                <div className="detail-section">
                  <div className="section-header">
                    <span className="section-title">Output</span>
                  </div>
                  <div className="section-content">
                    <div className="code-block output-preview">{step.toolOutput}</div>
                  </div>
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
              <div className="section-content">
                <div className="code-block">{formatJson(step.toolInput)}</div>
              </div>
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
              <div className="section-content">
                {step.toolOutput ? (
                  <div className="code-block">{step.toolOutput}</div>
                ) : (
                  <div className="empty-output">No output recorded</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "metadata" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Metadata</span>
              </div>
              <div className="section-content">
                <div className="code-block">
                  {JSON.stringify(
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
                </div>
              </div>
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
              <div className="section-content final-response-content">
                <div className="message-content">{response.content}</div>
              </div>
            </div>
          )}

          {activeTab === "metadata" && (
            <div className="detail-section">
              <div className="section-header">
                <span className="section-title">Metadata</span>
              </div>
              <div className="section-content">
                <div className="code-block">
                  {JSON.stringify(
                    {
                      id: response.id,
                      timestamp: response.timestamp,
                    },
                    null,
                    2
                  )}
                </div>
              </div>
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
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .detail-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    font-size: 14px;
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
    flex: 1;
  }

  .detail-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .detail-subtitle {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .json-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 11px;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .json-toggle:hover {
    color: var(--text-secondary);
  }

  .json-toggle input {
    display: none;
  }

  .json-toggle .toggle-track {
    width: 28px;
    height: 16px;
    background: var(--bg-active);
    border-radius: 8px;
    position: relative;
    transition: background 0.15s ease;
  }

  .json-toggle input:checked + .toggle-track {
    background: var(--accent-primary);
  }

  .json-toggle .toggle-thumb {
    width: 12px;
    height: 12px;
    background: var(--text-primary);
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.15s ease;
  }

  .json-toggle input:checked + .toggle-track .toggle-thumb {
    transform: translateX(12px);
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
    margin-bottom: var(--space-lg);
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

  .input-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .input-row {
    display: flex;
    gap: var(--space-sm);
  }

  .input-key {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 100px;
    flex-shrink: 0;
  }

  .input-value {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
    word-break: break-all;
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
