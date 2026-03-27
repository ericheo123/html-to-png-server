# Self-hosted n8n 세팅 가이드

이 문서는 `Render = 발행 서버`, `self-hosted n8n = 스케줄러/오케스트레이터` 구조로 운영할 때 필요한 최소 세팅만 정리합니다.

## 구조

- `Render`
  - 카드 6장 렌더
  - Cloudinary 업로드
  - Instagram 발행
  - Slack 알림
  - 중복 발행 차단

- `self-hosted n8n`
  - 매일 07:00 / 12:00 / 18:00 실행
  - 뉴스 후보 수집
  - 최종 기사 선정
  - 카드 payload 생성
  - Render `/generate` 호출

## 준비 파일

- Docker Compose: [n8n/docker-compose.yml](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n/docker-compose.yml)
- 환경변수 예시: [n8n/.env.example](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n/.env.example)
- 워크플로우 import: [n8n_workflow_instagram_news.json](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n_workflow_instagram_news.json)

## 빠른 시작

지금 구조에선 `docker compose`만 있으면 충분합니다. `make`는 필수는 아니고, 반복 명령을 줄이기 위한 편의용입니다.

1. `n8n/.env.example` 를 복사해 `n8n/.env` 생성
2. 비밀번호와 암호화 키를 변경
3. 아래 명령 실행

```bash
cd /Users/ericheo/Documents/CODEX/html-to-png-server/n8n
cp .env.example .env
docker compose up -d
```

4. 브라우저에서 `http://localhost:5678` 접속
5. n8n 첫 관리자 계정 생성
6. [n8n_workflow_instagram_news.json](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n_workflow_instagram_news.json) import

## 더 간단하게 쓰는 방법

[n8n/Makefile](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n/Makefile) 도 같이 넣어뒀습니다.

```bash
cd /Users/ericheo/Documents/CODEX/html-to-png-server/n8n
make init
make up
make open
```

자주 쓰는 명령:

- `make up`
- `make down`
- `make restart`
- `make logs`
- `make ps`
- `make open`

## 질문에 적은 항목들을 지금 구조로 다시 정리하면

필수:
- Docker 설치
- `n8n/.env` 생성
- `docker compose up -d`
- `http://localhost:5678` 접속

선택:
- 별도 Docker volume 수동 생성
  현재는 `docker-compose.yml`의 `./data` 바인드 마운트로 충분합니다.
- Docker Desktop에서 이미지/컨테이너 확인
  확인용으로 좋지만 필수는 아닙니다.
- 로컬 호스트 파일 수정
  커스텀 도메인 붙일 때만 필요합니다. 지금은 `localhost:5678`이면 충분합니다.
- `make`
  필수는 아니지만 반복 작업에는 편합니다.

## 접속 도메인과 타임존

로컬 테스트 기준 기본값:

- 접속 주소: `http://localhost:5678`
- 타임존: `Asia/Seoul`

커스텀 도메인을 붙일 때만 `.env`에서 아래를 바꾸면 됩니다.

- `N8N_HOST`
- `N8N_PROTOCOL`
- `WEBHOOK_URL`
- `N8N_EDITOR_BASE_URL`

## n8n에서 바꿔야 하는 값

### 1. `Render Publish API` 노드

- URL: `https://html-to-png-server.onrender.com/generate`
- 헤더:
  - `x-automation-token: <AUTOMATION_TRIGGER_TOKEN>`

### 2. `Prepare Payload` 노드

지금은 예시 JSON만 들어 있습니다. 이 노드를 실제 뉴스 선정 로직으로 교체해야 합니다.

최소 역할:
- 한국 뉴스 소스에서 국내시사/글로벌시사 후보 수집
- 기사 링크 기준 최근 발행 이력 제외
- 기사 1건 선택
- 카드 6장 구조 JSON 생성
- 캡션 생성

## Render와 연결할 때 필요한 값

- `AUTOMATION_TRIGGER_TOKEN`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SLACK_WEBHOOK_URL`

## 권장 운영 방식

- n8n은 로컬 Mac 또는 VPS 중 하나에 self-host
- 안정 운영은 VPS 권장
- 처음 테스트는 로컬에서도 충분

## 첫 테스트

1. Render `/health` 확인
2. Render `/preflight` 확인
3. n8n에서 워크플로우 수동 실행
4. Instagram publish id 확인
5. Slack 알림 확인
