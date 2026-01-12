import { useCallback, useEffect, useState } from "react";

export interface FilterState {
	search: string;
	status: "all" | "completed" | "running" | "error";
	dateRange: "all" | "today" | "week" | "month";
	tool: string;
	duration: "all" | "fast" | "normal" | "slow";
}

interface FilterBarProps {
	filters: FilterState;
	onFilterChange: (filters: FilterState) => void;
	showStatusFilter?: boolean;
	showToolFilter?: boolean;
	showDurationFilter?: boolean;
	placeholder?: string;
}

// Common tools for filter dropdown
const TOOL_OPTIONS = [
	{ value: "", label: "All Tools" },
	{ value: "Bash", label: "Bash" },
	{ value: "Read", label: "Read" },
	{ value: "Edit", label: "Edit" },
	{ value: "Write", label: "Write" },
	{ value: "Grep", label: "Grep" },
	{ value: "Glob", label: "Glob" },
	{ value: "Task", label: "Task" },
	{ value: "WebFetch", label: "WebFetch" },
	{ value: "WebSearch", label: "WebSearch" },
	{ value: "TodoWrite", label: "TodoWrite" },
];

export function FilterBar({
	filters,
	onFilterChange,
	showStatusFilter = false,
	showToolFilter = false,
	showDurationFilter = false,
	placeholder = "Search...",
}: FilterBarProps) {
	const [searchInput, setSearchInput] = useState(filters.search);

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			if (searchInput !== filters.search) {
				onFilterChange({ ...filters, search: searchInput });
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [searchInput, filters, onFilterChange]);

	// Update local search when filters.search changes externally
	useEffect(() => {
		setSearchInput(filters.search);
	}, [filters.search]);

	const handleChange = useCallback(
		(key: keyof FilterState, value: string) => {
			onFilterChange({ ...filters, [key]: value });
		},
		[filters, onFilterChange],
	);

	const activeFilterCount =
		(filters.status !== "all" ? 1 : 0) +
		(filters.dateRange !== "all" ? 1 : 0) +
		(filters.tool ? 1 : 0) +
		(filters.duration !== "all" ? 1 : 0);

	return (
		<div className="filter-bar">
			{/* Search Input */}
			<div className="search-box">
				<svg
					width="16"
					height="16"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<input
					type="text"
					placeholder={placeholder}
					value={searchInput}
					onChange={(e) => setSearchInput(e.target.value)}
				/>
				{searchInput && (
					<button
						className="clear-btn"
						onClick={() => {
							setSearchInput("");
							onFilterChange({ ...filters, search: "" });
						}}
					>
						<svg
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				)}
			</div>

			{/* Date Range Filter */}
			<select
				className="filter-select"
				value={filters.dateRange}
				onChange={(e) => handleChange("dateRange", e.target.value)}
			>
				<option value="all">All Time</option>
				<option value="today">Today</option>
				<option value="week">This Week</option>
				<option value="month">This Month</option>
			</select>

			{/* Status Filter */}
			{showStatusFilter && (
				<select
					className="filter-select"
					value={filters.status}
					onChange={(e) => handleChange("status", e.target.value)}
				>
					<option value="all">All Status</option>
					<option value="completed">Completed</option>
					<option value="running">Running</option>
					<option value="error">Error</option>
				</select>
			)}

			{/* Tool Filter */}
			{showToolFilter && (
				<select
					className="filter-select"
					value={filters.tool}
					onChange={(e) => handleChange("tool", e.target.value)}
				>
					{TOOL_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			)}

			{/* Duration Filter */}
			{showDurationFilter && (
				<select
					className="filter-select"
					value={filters.duration}
					onChange={(e) => handleChange("duration", e.target.value)}
				>
					<option value="all">All Duration</option>
					<option value="fast">&lt; 30s</option>
					<option value="normal">30s - 5m</option>
					<option value="slow">&gt; 5m</option>
				</select>
			)}

			{/* Active Filters Indicator */}
			{activeFilterCount > 0 && (
				<button
					className="clear-filters-btn"
					onClick={() =>
						onFilterChange({
							search: filters.search,
							status: "all",
							dateRange: "all",
							tool: "",
							duration: "all",
						})
					}
				>
					Clear filters ({activeFilterCount})
				</button>
			)}
		</div>
	);
}

// Default filter state helper
export function getDefaultFilters(): FilterState {
	return {
		search: "",
		status: "all",
		dateRange: "all",
		tool: "",
		duration: "all",
	};
}
