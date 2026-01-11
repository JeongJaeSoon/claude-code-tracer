import { type ReactElement, useCallback, useState } from "react";

interface CopyButtonProps {
	content: string;
	className?: string;
	variant?: "default" | "compact";
}

export function CopyButton({
	content,
	className = "",
	variant = "default",
}: CopyButtonProps): ReactElement {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [content]);

	const iconPath = copied ? (
		<polyline points="20,6 9,17 4,12" />
	) : (
		<>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5,15H4a2,2,0,0,1-2-2V4A2,2,0,0,1,4,2H15a2,2,0,0,1,2,2V5" />
		</>
	);

	if (variant === "compact") {
		return (
			<button
				className={`copy-btn-compact ${className}`}
				onClick={handleCopy}
				title="Copy code"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					{iconPath}
				</svg>
				<style>{copyButtonStyles}</style>
			</button>
		);
	}

	return (
		<button
			className={`copy-btn ${className}`}
			onClick={handleCopy}
			title="Copy to clipboard"
		>
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={copied ? 2.5 : 2}
			>
				{iconPath}
			</svg>
			<span>{copied ? "Copied!" : "Copy"}</span>
			<style>{copyButtonStyles}</style>
		</button>
	);
}

const copyButtonStyles = `
  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-secondary);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .copy-btn span {
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .copy-btn-compact {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn-compact:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }
`;
