import { useState, useEffect } from "react";

interface ToolCall {
  id: string;
  toolName: string;
  toolInput: string | null;
  durationMs: number | null;
  startTime: number;
  isError: boolean;
  timestamp: string;
}

interface Message {
  id: string;
  type: "user" | "assistant" | "summary";
  content: string | null;
  timestamp: string;
}

interface Session {
  id: string;
  projectName: string;
  projectDir: string;
  model: string | null;
  startedAt: string;
  endedAt: string | null;
  totalDurationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  toolCallCount: number;
  subAgentCount: number;
  status: "running" | "completed" | "error";
  toolCalls: ToolCall[];
  messages: Message[];
}

interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
}

export function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  async function fetchSession() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      setSession(data);
    } catch (error) {
      console.error("Failed to fetch session:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return "-";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  }

  function formatTokens(tokens: number): string {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return String(tokens);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getToolColor(toolName: string): string {
    const colors: Record<string, string> = {
      Bash: "var(--tool-bash)",
      Read: "var(--tool-read)",
      Edit: "var(--tool-edit)",
      Write: "var(--tool-write)",
      Grep: "var(--tool-grep)",
      Glob: "var(--tool-glob)",
      Task: "var(--tool-task)",
      WebFetch: "var(--tool-web)",
      WebSearch: "var(--tool-web)",
    };
    return colors[toolName] || "var(--text-tertiary)";
  }

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="error-container">
        <p>Session not found</p>
        <button className="btn btn-primary" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <div>
          <div className="breadcrumb">
            <button className="breadcrumb-link" onClick={onBack}>Sessions</button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{session.projectName}</span>
          </div>
          <h1 className="page-title">Session {session.id.slice(0, 18)}</h1>
          <div className="detail-meta">
            <span className="meta-item">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {formatDate(session.startedAt)}
            </span>
            <span className="meta-divider">•</span>
            <span className="meta-item">{formatDuration(session.totalDurationMs)}</span>
            {session.model && (
              <>
                <span className="meta-divider">•</span>
                <span className="meta-item">{session.model}</span>
              </>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={onBack}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Back
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Metrics Panel */}
        <div className="metrics-panel">
          <div className="metric-card">
            <div className="metric-icon">⏱️</div>
            <div className="metric-value">{formatDuration(session.totalDurationMs)}</div>
            <div className="metric-label">Duration</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">📥</div>
            <div className="metric-value">{formatTokens(session.inputTokens)}</div>
            <div className="metric-label">Input Tokens</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">📤</div>
            <div className="metric-value">{formatTokens(session.outputTokens)}</div>
            <div className="metric-label">Output Tokens</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">💾</div>
            <div className="metric-value">{formatTokens(session.cacheReadTokens)}</div>
            <div className="metric-label">Cache Tokens</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🔧</div>
            <div className="metric-value">{session.toolCallCount}</div>
            <div className="metric-label">Tool Calls</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🤖</div>
            <div className="metric-value">{session.subAgentCount}</div>
            <div className="metric-label">Sub-agents</div>
          </div>
        </div>

        {/* Flamegraph Placeholder */}
        <div className="flamegraph-section">
          <div className="flamegraph-header">
            <div className="flamegraph-title">Flamegraph</div>
            <div className="flamegraph-note">
              flame-chart-js integration coming soon
            </div>
          </div>
          <div className="flamegraph-canvas">
            {session.toolCalls.length === 0 ? (
              <div className="empty-flamegraph">No tool calls recorded</div>
            ) : (
              <div className="simple-flamegraph">
                {session.toolCalls.slice(0, 20).map((tool, index) => (
                  <div
                    key={tool.id}
                    className="flame-bar"
                    style={{
                      width: `${Math.max(10, (tool.durationMs || 100) / 100)}%`,
                      maxWidth: "100%",
                      backgroundColor: getToolColor(tool.toolName),
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <span className="flame-label">{tool.toolName}</span>
                    <span className="flame-duration">{tool.durationMs}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="timeline-section">
          <div className="timeline-header">
            <div className="timeline-title">Event Timeline</div>
          </div>
          <div className="timeline-content">
            {session.toolCalls.map((tool) => (
              <div key={tool.id} className="timeline-item">
                <div
                  className="timeline-icon"
                  style={{ backgroundColor: `${getToolColor(tool.toolName)}20`, color: getToolColor(tool.toolName) }}
                >
                  {tool.toolName.charAt(0)}
                </div>
                <div className="timeline-body">
                  <div className="timeline-name">{tool.toolName}</div>
                  <div className="timeline-detail">
                    {tool.toolInput ? truncateJson(tool.toolInput, 60) : "-"}
                  </div>
                </div>
                <div className="timeline-meta">
                  <div className="timeline-time">{formatTime(tool.timestamp)}</div>
                  <div className="timeline-duration">{tool.durationMs}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .main-header {
          padding: var(--space-lg) var(--space-xl);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-size: 13px;
          margin-bottom: var(--space-sm);
        }

        .breadcrumb-link {
          color: var(--text-tertiary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-size: inherit;
        }

        .breadcrumb-link:hover {
          color: var(--text-primary);
        }

        .breadcrumb-sep {
          color: var(--text-muted);
        }

        .breadcrumb-current {
          color: var(--text-primary);
          font-weight: 500;
        }

        .page-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .detail-meta {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: var(--space-xs);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
        }

        .meta-divider {
          color: var(--text-muted);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-primary {
          background: var(--accent-primary);
          color: white;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-default);
        }

        .btn-ghost:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .main-content {
          flex: 1;
          padding: var(--space-xl);
          padding-bottom: var(--space-2xl);
          overflow-y: auto;
        }

        .metrics-panel {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: var(--space-md);
          margin-bottom: var(--space-xl);
        }

        .metric-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: var(--space-md);
          text-align: center;
        }

        .metric-icon {
          width: 32px;
          height: 32px;
          margin: 0 auto var(--space-sm);
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .metric-value {
          font-size: 20px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }

        .metric-label {
          font-size: 11px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-top: 2px;
        }

        .flamegraph-section {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
          margin-bottom: var(--space-xl);
        }

        .flamegraph-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
        }

        .flamegraph-title {
          font-size: 14px;
          font-weight: 600;
        }

        .flamegraph-note {
          font-size: 12px;
          color: var(--text-muted);
        }

        .flamegraph-canvas {
          min-height: 200px;
          padding: var(--space-lg);
          background: var(--bg-primary);
        }

        .empty-flamegraph {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 150px;
          color: var(--text-muted);
        }

        .simple-flamegraph {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .flame-bar {
          height: 28px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-sm);
          font-size: 11px;
          font-weight: 500;
          color: white;
          animation: fadeInUp 0.3s ease-out backwards;
        }

        .flame-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .flame-duration {
          font-family: var(--font-mono);
          font-size: 10px;
          opacity: 0.8;
        }

        .timeline-section {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .timeline-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 600;
        }

        .timeline-content {
          max-height: 400px;
          overflow-y: auto;
        }

        .timeline-item {
          display: flex;
          gap: var(--space-md);
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
          transition: background var(--transition-fast);
        }

        .timeline-item:last-child {
          border-bottom: none;
        }

        .timeline-item:hover {
          background: var(--bg-hover);
        }

        .timeline-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .timeline-body {
          flex: 1;
          min-width: 0;
        }

        .timeline-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .timeline-detail {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .timeline-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }

        .timeline-time {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }

        .timeline-duration {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: var(--space-md);
          color: var(--text-tertiary);
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

function truncateJson(json: string, maxLen: number): string {
  try {
    const parsed = JSON.parse(json);
    if (parsed.command) return parsed.command.slice(0, maxLen);
    if (parsed.file_path) return parsed.file_path;
    if (parsed.pattern) return parsed.pattern;
    if (parsed.description) return parsed.description.slice(0, maxLen);
    return JSON.stringify(parsed).slice(0, maxLen);
  } catch {
    return json.slice(0, maxLen);
  }
}
