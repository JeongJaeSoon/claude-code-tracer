#!/bin/bash

# Claude Code Stop Hook - 데이터 디버깅용
# stdin으로 전달되는 JSON 데이터와 transcript 내용을 로그 파일에 저장합니다.

LOG_DIR="/Users/dev-soon/workspace/project/claude-code-tracer/.claude/hooks/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/stop_hook_${TIMESTAMP}.log"

# stdin에서 JSON 데이터 읽기
read -r HOOK_INPUT

# 로그 파일에 기록
{
    echo "=========================================="
    echo "Stop Hook 실행 시간: $(date)"
    echo "=========================================="
    echo ""
    echo ">>> stdin으로 받은 JSON 데이터:"
    echo "$HOOK_INPUT" | jq . 2>/dev/null || echo "$HOOK_INPUT"
    echo ""

    # transcript_path 추출
    TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path' 2>/dev/null)

    if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
        echo ">>> Transcript 파일 경로: $TRANSCRIPT_PATH"
        echo ">>> Transcript 파일 크기: $(wc -c < "$TRANSCRIPT_PATH") bytes"
        echo ">>> Transcript 라인 수: $(wc -l < "$TRANSCRIPT_PATH") lines"
        echo ""
        echo ">>> Transcript 내용 (처음 50줄):"
        echo "-------------------------------------------"
        head -n 50 "$TRANSCRIPT_PATH"
        echo ""
        echo "-------------------------------------------"
        echo "(전체 내용은 $TRANSCRIPT_PATH 에서 확인)"
    else
        echo ">>> Transcript 파일을 찾을 수 없습니다: $TRANSCRIPT_PATH"
    fi

    echo ""
    echo "=========================================="
    echo "로그 저장 완료: $LOG_FILE"
    echo "=========================================="
} > "$LOG_FILE" 2>&1

# 성공적으로 완료
exit 0
