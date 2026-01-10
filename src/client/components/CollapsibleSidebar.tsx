import type { ReactNode } from "react";

interface CollapsibleSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  title?: string;
  children: ReactNode;
}

export function CollapsibleSidebar({
  collapsed,
  onToggle,
  title = "TRACE",
  children,
}: CollapsibleSidebarProps) {
  return (
    <aside className={`collapsible-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          {!collapsed && <span>{title}</span>}
        </div>
        {!collapsed && (
          <div className="sidebar-actions">
            <button className="icon-btn" title="Settings">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button className="icon-btn" title="Expand">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {!collapsed && <div className="sidebar-content">{children}</div>}

      <button
        className="sidebar-toggle"
        onClick={onToggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: collapsed ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <style>{`
        .collapsible-sidebar {
          width: 320px;
          min-width: 320px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          position: relative;
          transition: width 0.25s ease, min-width 0.25s ease;
          flex-shrink: 0;
        }

        .collapsible-sidebar.collapsed {
          width: 48px;
          min-width: 48px;
        }

        .sidebar-header {
          padding: var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 52px;
          flex-shrink: 0;
        }

        .sidebar-title {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }

        .collapsible-sidebar.collapsed .sidebar-title {
          justify-content: center;
        }

        .sidebar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
        }

        .icon-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .icon-btn:hover {
          background: var(--bg-hover);
          color: var(--text-secondary);
          border-color: var(--border-subtle);
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar-toggle {
          position: absolute;
          right: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 48px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.15s ease;
          z-index: 10;
        }

        .sidebar-toggle:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
          border-color: var(--accent-primary);
        }
      `}</style>
    </aside>
  );
}
