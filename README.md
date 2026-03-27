# Instagram News Render Service

GitHub + Render + self-hosted n8n 기준으로 운영하는 카드뉴스 렌더/발행 서비스입니다.

## 역할

- 카드 데이터 JSON을 받아 6장 카드 이미지를 렌더
- Cloudinary 업로드
- Instagram 캐러셀 발행
- Slack 알림
- 기사 링크 기준 중복 발행 차단

## 엔드포인트

### `GET /health`

서비스 상태 확인

### `GET /history`

최근 발행 이력 조회

헤더:

- `x-automation-token: <AUTOMATION_TRIGGER_TOKEN>`

### `POST /preflight`

Instagram, Cloudinary, Slack 외부 연결 상태 확인

헤더:

- `x-automation-token: <AUTOMATION_TRIGGER_TOKEN>`

### `POST /generate`

카드 렌더 및 발행 실행

헤더:

- `x-automation-token: <AUTOMATION_TRIGGER_TOKEN>`

## 요청 예시

```json
{
  "topic": "청년 취업 지연과 주거비 상승의 이중 부담",
  "sourceUrl": "https://en.yna.co.kr/view/AEN20260119004300320",
  "sourceTitle": "Young S. Koreans face double strain from longer job searches, rising housing costs",
  "caption": "청년층은 지금 취업과 주거에서 동시에 압박을 받고 있습니다.",
  "publishToInstagram": true,
  "notifySlackOnPublish": true,
  "data": {
    "date": "2026-03-27",
    "topic": "청년 취업 지연과 주거비 상승의 이중 부담",
    "caption": "청년층은 지금 취업과 주거에서 동시에 압박을 받고 있습니다.",
    "cards": [
      {
        "type": "cover",
        "eyebrow": "국내 시사 브리핑",
        "headline_main": "[[취업]]도 늦고 [[월세]]도 비싸다",
        "headline_sub": "청년의 첫 출발이 더 힘들어지고 있습니다",
        "summary": "구직 기간과 주거비 부담이 동시에 커지고 있습니다.",
        "hashtags": ["#청년취업", "#월세부담", "#청년부채"]
      },
      {
        "type": "stats",
        "eyebrow": "핵심 팩트",
        "title": "숫자로 보면 더 선명해요",
        "items": [
          { "label": "정규직 확률", "value": "66.1%", "desc": "실업 1년 뒤 5년 내 정규직 가능성" },
          { "label": "정규직 확률", "value": "56.2%", "desc": "실업 3년이면 더 낮아짐" },
          { "label": "임금 영향", "value": "-6.7%", "desc": "실업 1년 증가 시 실질임금 감소폭" },
          { "label": "부채 비중", "value": "49.6%", "desc": "청년 부채의 가계부채 내 비중" }
        ]
      },
      {
        "type": "impact",
        "eyebrow": "배경·원인",
        "title": "왜 청년층이 더 오래 흔들릴까",
        "items": [
          { "label": "경력 선호 확대", "desc": "기업의 신입 채용 문턱이 높아졌습니다." },
          { "label": "출발이 늦어짐", "desc": "첫 직장 진입이 늦을수록 이후 소득도 약해집니다." },
          { "label": "저축 여력 축소", "desc": "월세와 생활비가 자산 축적 속도를 늦춥니다." }
        ]
      },
      {
        "type": "causes",
        "eyebrow": "상세 흐름",
        "title": "주거 숫자까지 보면 압박이 더 커집니다",
        "items": [
          { "label": "열악 주거", "value": "11.5%", "desc": "청년 열악 주거 비중" },
          { "label": "자산 감소", "value": "0.04%", "desc": "집값 1% 상승 시 총자산 감소 추정" },
          { "label": "청년 부채", "value": "49.6%", "desc": "가계부채 내 청년 부채 비중" }
        ],
        "warning": "취업 지연과 주거 부담이 함께 오면 청년 자산 형성이 동시에 눌립니다."
      },
      {
        "type": "action",
        "eyebrow": "영향·대응",
        "title": "지금 바로 봐야 할 포인트",
        "items": [
          { "label": "취업 준비생", "desc": "구직 공백을 줄이는 전략이 더 중요해졌습니다." },
          { "label": "사회초년생", "desc": "월세와 고정비 구조부터 점검해야 합니다." },
          { "label": "정책 관찰", "desc": "청년 일자리와 소형 주택 공급을 같이 봐야 합니다." }
        ],
        "closing": "청년 경제는 취업과 주거를 따로 볼 수 없습니다."
      },
      {
        "type": "closing",
        "title": "[[취업 공백]]이 길면 [[임금]]과 [[자산]]이 같이 약해집니다",
        "summary": "핵심은 구직 기간, 월세 고정비, 청년 부채입니다.",
        "cta": "저장해두고 내 고정비와 구직 기간을 함께 점검해 보세요.",
        "hashtags": ["#청년취업", "#월세부담", "#청년부채", "#자산형성"]
      }
    ]
  }
}
```

## 배포 파일

- Render 설정: [render.yaml](/Users/ericheo/Documents/CODEX/html-to-png-server/render.yaml)
- n8n import 파일: [n8n_workflow_instagram_news.json](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n_workflow_instagram_news.json)
- self-hosted n8n 가이드: [N8N_SELF_HOSTED_SETUP.md](/Users/ericheo/Documents/CODEX/html-to-png-server/N8N_SELF_HOSTED_SETUP.md)
- self-hosted n8n Makefile: [n8n/Makefile](/Users/ericheo/Documents/CODEX/html-to-png-server/n8n/Makefile)
- 환경 변수 예시: [.env.example](/Users/ericheo/Documents/CODEX/html-to-png-server/.env.example)
- 운영 계획: [DEPLOYMENT_PLAN.md](/Users/ericheo/Documents/CODEX/html-to-png-server/DEPLOYMENT_PLAN.md)
