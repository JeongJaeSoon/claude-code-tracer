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
		</aside>
	);
}
