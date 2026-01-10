/**
 * Format session ID with different display variants
 * @param id - Full session UUID
 * @param variant - Display style: full, short (18 chars), or minimal (8 chars)
 */
export function formatSessionId(
  id: string,
  variant: "full" | "short" | "minimal" = "short"
): string {
  switch (variant) {
    case "full":
      return id;
    case "short":
      return id.slice(0, 18);
    case "minimal":
      return id.slice(0, 8);
    default:
      return id;
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format token count with K/M suffix
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

/**
 * Format date to localized string
 */
export function formatDate(dateStr: string, style: "short" | "long" = "short"): string {
  const date = new Date(dateStr);
  if (style === "long") {
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
