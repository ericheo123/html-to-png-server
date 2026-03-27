# 실제 연결 체크리스트

이 문서는 GitHub, Render, n8n에 실제로 연결할 때 필요한 값만 빠르게 정리한 체크리스트입니다.

## 1. GitHub

필요한 정보:

- 현재 저장소 사용 여부
  - `https://github.com/ericheo123/html-to-png-server`
- 또는 새 저장소 이름

할 일:

- 이 디렉터리 변경사항 커밋
- GitHub에 push

## 2. Render

필요한 정보:

- Render 계정 접근
- 연결할 GitHub 저장소
- 서비스 이름
- 사용할 플랜

Render에 넣을 비밀값:

- `AUTOMATION_TRIGGER_TOKEN`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SLACK_WEBHOOK_URL`

검증:

- `/health`
- `/preflight`

## 3. self-hosted n8n

필요한 정보:

- n8n을 띄울 서버 또는 로컬 머신
- n8n 접속 URL

세팅할 값:

- Render 서비스 URL
- `AUTOMATION_TRIGGER_TOKEN`

할 일:

- [N8N_SELF_HOSTED_SETUP.md](/Users/ericheo/Documents/CODEX/html-to-png-server/N8N_SELF_HOSTED_SETUP.md) 기준으로 n8n 실행
- [n8n_workflow_instagram_news.json](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n_workflow_instagram_news.json) import
- `Prepare Payload` 노드를 실제 뉴스 탐색/카드 데이터 생성 흐름으로 교체
- HTTP Request 노드 URL을 Render 서비스 URL로 교체

## 4. 현재 이미 있는 값

이미 확보된 값:

- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SLACK_WEBHOOK_URL`

새로 정하면 되는 값:

- `AUTOMATION_TRIGGER_TOKEN`
- Render 서비스 URL
- self-hosted n8n 접속 정보

## 5. 첫 운영 테스트

1. Render 배포 완료
2. `/preflight` 성공 확인
3. n8n에서 수동 실행 1회
4. Instagram publish id 확인
5. Slack 성공 알림 확인
