#!/bin/bash
# Claude Code Tracer - Stop Hook
# This script sends session data to the tracer server when a Claude Code session ends
#
# Optimization: Only sends the last 50 lines of each file per turn
# The server uses UUID-based deduplication to handle overlapping data

TRACE_SERVER="${TRACE_SERVER:-http://localhost:8080}"
LINES_TO_SEND="${LINES_TO_SEND:-50}"

# Read stdin (hook input JSON)
INPUT=$(cat)

# Extract transcript_path from stdin JSON
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # Send last N lines of main session file
  # Content is sent directly via POST body (not file path)
  tail -"$LINES_TO_SEND" "$TRANSCRIPT_PATH" | \
    curl -s -X POST "$TRACE_SERVER/api/ingest" \
      -H "Content-Type: text/plain" \
      -d @- > /dev/null 2>&1

  # Check for sub-agents directory
  # Path pattern: {sessionId}.jsonl -> {sessionId}/subagents/
  SESSION_DIR="${TRANSCRIPT_PATH%.jsonl}"
  SUBAGENTS_DIR="$SESSION_DIR/subagents"

  if [ -d "$SUBAGENTS_DIR" ]; then
    # Send last N lines of each sub-agent file
    for subfile in "$SUBAGENTS_DIR"/*.jsonl; do
      if [ -f "$subfile" ]; then
        tail -"$LINES_TO_SEND" "$subfile" | \
          curl -s -X POST "$TRACE_SERVER/api/ingest" \
            -H "Content-Type: text/plain" \
            -d @- > /dev/null 2>&1
      fi
    done
  fi
fi

# Return success to Claude Code
echo '{"status": "ok"}'
