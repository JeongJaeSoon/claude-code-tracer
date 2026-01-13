# Claude Code Tracer

Claude Code 세션을 TraceTree로 시각화하는 Self-hosted 트레이싱 도구입니다.

## 특징

- **TraceTree 시각화**: Lane(Main/Sub-agent) → Turn(사용자→어시스턴트) → Step(도구 호출) 구조로 세션 분석
- **Sub-agent 추적**: 동일 세션 내 여러 에이전트를 별도 Lane으로 표시
- **실행 시간 분석**: 각 도구 호출의 Duration 바 시각화
- **두 가지 실행 모드**: Local Mode와 Server Mode 지원

## 요구사항

- [Bun](https://bun.sh/) v1.0+
- Node.js 18+ (Bun이 없는 환경에서)

## 설치

```bash
git clone https://github.com/JeongJaeSoon/claude-code-tracer.git
cd claude-code-tracer
bun install
bun run build
```

## 사용법

### CLI 명령어

```bash
# 도움말 보기
bun run cli help

# Local Mode - ~/.claude 스캔 후 읽기 전용 UI
bun run cli local [options]

# Server Mode - DB 기반, Stop Hook 수집
bun run cli server [options]
```

### 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--port=PORT` | 서버 포트 지정 | 8080 |
| `--no-open` | 브라우저 자동 열기 비활성화 | false |

### 실행 예시

```bash
# Local Mode: 기본 포트(8080)에서 실행, 브라우저 자동 오픈
bun run cli local

# Local Mode: 포트 3000에서 실행
bun run cli local --port=3000

# Server Mode: 브라우저 열지 않고 실행
bun run cli server --no-open

# Server Mode: 포트 9090에서 실행
bun run cli server --port=9090
```

### 단축 명령어

```bash
bun run start:local   # bun run cli local 과 동일
bun run start:server  # bun run cli server 와 동일
```

## 실행 모드 비교

| 기능 | Local Mode | Server Mode |
|------|-----------|-------------|
| **데이터 소스** | `~/.claude` 디렉토리 스캔 | Stop Hook POST 요청 |
| **저장소** | 메모리 (Map) | SQLite |
| **세션 조회** | ✅ | ✅ |
| **세션 삭제** | ❌ | ✅ |
| **데이터 수집** | ❌ (시작 시 1회 스캔) | ✅ (실시간 수집) |
| **데이터 영속성** | ❌ (재시작 시 재스캔) | ✅ |
| **사용 사례** | 기존 세션 빠른 조회 | 지속적인 데이터 수집 |

## Local Mode

기존 Claude Code 세션을 빠르게 확인하고 싶을 때 사용합니다.

```bash
bun run cli local
```

**동작 방식:**
1. `~/.claude/projects` 디렉토리 재귀 스캔
2. 모든 세션 JSONL 파일 파싱
3. 메모리에 로드 후 UI 제공
4. 읽기 전용 (수정/삭제 불가)

**장점:**
- 별도 설정 없이 바로 사용 가능
- 기존 세션 데이터 즉시 확인
- DB 설정 불필요

**제한:**
- 시작 시 전체 스캔으로 초기 로딩 시간 소요
- 새 세션 자동 반영 안 됨 (재시작 필요)
- 세션 삭제 불가

## Server Mode

Claude Code와 연동하여 실시간으로 세션을 수집하고 싶을 때 사용합니다.

```bash
bun run cli server
```

**동작 방식:**
1. SQLite 데이터베이스 사용
2. Stop Hook을 통해 세션 데이터 수신
3. 실시간 데이터 저장 및 UI 제공
4. 읽기/쓰기 가능

### Stop Hook 설정

Claude Code의 Stop Hook을 설정하여 세션 종료 시 자동으로 데이터를 전송합니다.

**~/.claude/settings.json:**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST http://localhost:8080/api/ingest -H 'Content-Type: text/plain' --data-binary @-"
          }
        ]
      }
    ]
  }
}
```

**원격 서버 사용 시:**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST https://your-server.com/api/ingest -H 'Content-Type: text/plain' --data-binary @-"
          }
        ]
      }
    ]
  }
}
```

### API 엔드포인트

| Method | Endpoint | 설명 | 모드 |
|--------|----------|------|------|
| GET | `/api/sessions` | 세션 목록 조회 | 공통 |
| GET | `/api/sessions/:id` | 세션 상세 조회 | 공통 |
| DELETE | `/api/sessions/:id` | 세션 삭제 | Server만 |
| GET | `/api/projects` | 프로젝트 목록 조회 | 공통 |
| GET | `/api/projects/:name/sessions` | 프로젝트별 세션 조회 | 공통 |
| GET | `/api/timeline/:sessionId` | 타임라인 데이터 조회 | 공통 |
| POST | `/api/ingest` | 세션 데이터 수집 | Server만 |

## 개발

### 개발 서버 실행

```bash
# 터미널 1: 백엔드 (Hono)
bun run dev:server

# 터미널 2: 프론트엔드 (Vite)
bun run dev:client
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173

### 프로덕션 빌드

```bash
bun run build
bun run start  # dist/server/start.js 실행
```

### 코드 품질

```bash
bun run format  # 코드 포맷팅 (Biome)
bun run lint    # 린트 검사 (Biome)
bun run check   # 포맷팅 + 린트
```

### 데이터베이스

```bash
bun run db:generate  # 스키마 생성
bun run db:migrate   # 마이그레이션
bun run db:studio    # Drizzle Studio
```

## 기술 스택

- **Runtime**: Bun
- **Backend**: Hono
- **Frontend**: React + Vite
- **Database**: SQLite + Drizzle ORM
- **Formatter/Linter**: Biome

## 라이선스

MIT

## 참고

- 상세 설계: `docs/claude-code-tracer-design.md`
