#!/bin/bash
# Claude Code Tracer - Stop Hook
# This script sends session data to the tracer server when a Claude Code session ends

TRACE_SERVER="${TRACE_SERVER:-http://localhost:8080}"

# Read stdin (hook input JSON)
INPUT=$(cat)

# Extract conversation file path from environment or stdin
CONVERSATION_FILE="${CLAUDE_CONVERSATION_FILE:-}"

if [ -z "$CONVERSATION_FILE" ]; then
  # Try to extract from stdin JSON
  CONVERSATION_FILE=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
fi

if [ -n "$CONVERSATION_FILE" ] && [ -f "$CONVERSATION_FILE" ]; then
  # Send file path to server
  curl -s -X POST "$TRACE_SERVER/api/ingest/file" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$CONVERSATION_FILE\"}" > /dev/null 2>&1
fi

# Return success to Claude Code
echo '{"status": "ok"}'
