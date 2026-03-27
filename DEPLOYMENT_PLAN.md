# GitHub + Render + self-hosted n8n 운영 설계

## 목표

- GitHub에 코드를 올리고
- Render에서 카드 렌더 + Cloudinary 업로드 + Instagram 발행 + Slack 알림을 수행하고
- self-hosted n8n은 스케줄과 오케스트레이션만 담당합니다.

## 권장 구조

1. `self-hosted n8n`
- 매일 07:00, 12:00, 18:00 실행
- 뉴스 후보 수집
- 기사 선택
- 카드 데이터 JSON 생성
- Render `/generate` 호출

2. `Render web service`
- `/health`
- `/preflight`
- `/history`
- `/generate`

3. `GitHub`
- 이 디렉터리를 별도 저장소로 푸시
- Render가 GitHub 저장소를 자동 배포

## Render 서비스 역할

- 입력받은 카드 데이터 정규화
- SVG 기반 카드 6장 렌더
- Cloudinary 업로드
- Instagram 캐러셀 발행
- Slack 알림
- `STATE_DIR` 기준 중복 발행 이력 저장

## n8n 역할

- 스케줄 실행
- 기사 후보 탐색 및 선택
- 기사 본문/메모를 카드 데이터 JSON으로 변환
- Render 응답 성공/실패 분기

## 필요한 정보

### GitHub

- 새 저장소 이름

### Render

- Render 서비스명
- GitHub 연결 여부
- 사용할 플랜

### self-hosted n8n

- n8n을 띄울 위치
- n8n 접속 URL

### 공통 비밀값

- `AUTOMATION_TRIGGER_TOKEN`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SLACK_WEBHOOK_URL`

## 배포 순서

1. 이 폴더를 GitHub 저장소로 올립니다.
2. Render에서 `render.yaml` 기준으로 web service를 생성합니다.
3. Render 환경변수를 채웁니다.
4. Render `/health` 와 `/preflight` 를 확인합니다.
5. self-hosted n8n을 실행합니다.
6. n8n에 `n8n_workflow_instagram_news.json` 을 import 합니다.
7. n8n의 `Prepare Payload` 노드를 실제 뉴스 선택/카드 데이터 생성 노드로 바꿉니다.
8. 수동 1회 실행으로 Instagram 발행을 검증합니다.

## 지금 상태

- Render web service 본체 코드: 준비됨
- Cloudinary 업로드: 준비됨
- Instagram API 발행: 준비됨
- Slack 알림: 준비됨
- 중복 링크 차단: 준비됨
- self-hosted n8n 배포 파일: 준비됨
- n8n import 템플릿: 준비됨
- 뉴스 탐색/카드 데이터 생성 노드: n8n에서 연결 필요
