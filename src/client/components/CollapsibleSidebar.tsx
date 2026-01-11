import type { ReactElement, ReactNode } from "react";

interface CollapsibleSidebarProps {
	collapsed: boolean;
	onToggle: () => void;
	children: ReactNode;
}

const TraceIcon = (): ReactElement => (
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
);

interface ChevronIconProps {
	collapsed: boolean;
}

const ChevronIcon = ({ collapsed }: ChevronIconProps): ReactElement => (
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
);

export function CollapsibleSidebar({
	collapsed,
	onToggle,
	children,
}: CollapsibleSidebarProps): ReactElement {
	return (
		<aside className={`collapsible-sidebar ${collapsed ? "collapsed" : ""}`}>
			{collapsed && (
				<div className="sidebar-header-collapsed">
					<TraceIcon />
				</div>
			)}

			{!collapsed && <div className="sidebar-content">{children}</div>}

			<button
				className="sidebar-toggle"
				onClick={onToggle}
				title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
			>
				<ChevronIcon collapsed={collapsed} />
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

        .sidebar-header-collapsed {
          padding: var(--space-sm) var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 41px;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar-toggle {
          position: absolute;
          right: -14px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: 50%;
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
