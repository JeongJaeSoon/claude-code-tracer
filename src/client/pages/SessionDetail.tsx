import { useState, useEffect, useMemo } from "react";
import { TraceTree, type SelectedItem } from "../components/TraceTree.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import type { TimelineData, Session } from "../types/timeline.ts";

interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
}

export function SessionDetail({ sessionId, onBack }: SessionDetailProps): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  async function fetchData() {
    try {
      const [sessionRes, timelineRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/timeline/${sessionId}`),
      ]);

      const sessionData = await sessionRes.json();
      const tlData = await timelineRes.json();

      setSession(sessionData);
      setTimelineData(tlData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate max duration for duration bars
  const maxDuration = useMemo(() => {
    if (!timelineData) return 1000;

    let max = 0;
    for (const lane of timelineData.lanes) {
      for (const turn of lane.turns) {
        // Sum tool durations per turn
        const turnToolDuration = turn.steps
          .filter(s => s.type === "tool")
          .reduce((sum, s) => sum + (s.toolDuration || 0), 0);
        if (turnToolDuration > max) max = turnToolDuration;
      }
    }
    return max || 1000;
  }, [timelineData]);

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
    <div className="session-detail-container">
      {/* Header */}
      <header className="session-header">
        <div className="header-left">
          <div className="breadcrumb">
            <button className="breadcrumb-link" onClick={onBack}>Sessions</button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-project">{session.projectName}</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{session.id.slice(0, 18)}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => fetchData()}>
            <span>↻</span> Refresh
          </button>
          <button className="btn btn-ghost" onClick={onBack}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Back
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-icon duration">⏱</div>
          <div className="stat-content">
            <div className="stat-value">{formatDuration(session.totalDurationMs)}</div>
            <div className="stat-label">Duration</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon tokens">◈</div>
          <div className="stat-content">
            <div className="stat-value">{formatTokens(session.inputTokens + session.outputTokens)}</div>
            <div className="stat-label">Tokens</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon tools">⚙</div>
          <div className="stat-content">
            <div className="stat-value">{session.toolCallCount}</div>
            <div className="stat-label">Tools</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon agents">◉</div>
          <div className="stat-content">
            <div className="stat-value">{session.subAgentCount}</div>
            <div className="stat-label">Sub-agents</div>
          </div>
        </div>
        {session.model && (
          <div className="stat-item">
            <div className="stat-icon model">🤖</div>
            <div className="stat-content">
              <div className="stat-value model-name">{session.model}</div>
              <div className="stat-label">Model</div>
            </div>
          </div>
        )}
      </div>

      {/* Content Area - Two Panel Layout */}
      <div className="content-area">
        {/* Left: Trace Tree */}
        <div className="trace-panel">
          {timelineData ? (
            <TraceTree
              data={timelineData}
              maxDuration={maxDuration}
              onSelect={setSelectedItem}
              selectedItem={selectedItem}
            />
          ) : (
            <div className="loading-panel">Loading trace...</div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="detail-panel-wrapper">
          <DetailPanel selectedItem={selectedItem} />
        </div>
      </div>

      <style>{`
        .session-detail-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* Header */
        .session-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-size: 13px;
        }

        .breadcrumb-link {
          color: var(--text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-size: inherit;
          transition: color 0.15s;
        }

        .breadcrumb-link:hover {
          color: var(--accent-primary);
        }

        .breadcrumb-sep {
          color: var(--text-muted);
          opacity: 0.5;
        }

        .breadcrumb-project {
          color: var(--text-secondary);
        }

        .breadcrumb-current {
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-weight: 600;
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
          transition: all 0.15s;
          font-family: var(--font-sans);
        }

        .btn-primary {
          background: var(--accent-primary);
          color: white;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }

        .btn-ghost:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }

        /* Stats Bar */
        .stats-bar {
          display: flex;
          gap: var(--space-md);
          padding: var(--space-md) var(--space-lg);
          background: var(--bg-elevated);
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          overflow-x: auto;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }

        .stat-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          font-size: 14px;
        }

        .stat-icon.duration { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .stat-icon.tokens { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .stat-icon.tools { background: rgba(249, 115, 22, 0.15); color: #f97316; }
        .stat-icon.agents { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
        .stat-icon.model { background: rgba(236, 72, 153, 0.15); color: #ec4899; }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 15px;
          color: var(--text-primary);
        }

        .stat-value.model-name {
          font-size: 12px;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Content Area */
        .content-area {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .trace-panel {
          width: 50%;
          min-width: 400px;
          max-width: 600px;
          overflow: hidden;
        }

        .detail-panel-wrapper {
          flex: 1;
          overflow: hidden;
          min-width: 400px;
        }

        .loading-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
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
      `}</style>
    </div>
  );
}
