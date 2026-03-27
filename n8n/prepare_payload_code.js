const triggerToken = 'insta-news-2026-very-secret-key-abc123';
const historyUrl = 'https://html-to-png-server.onrender.com/history?limit=100';
const feeds = [
  {
    lane: 'domestic',
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('청년 취업 주거비') + '&hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    lane: 'domestic',
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('가계부채 한국') + '&hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    lane: 'global',
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('국제유가 한국') + '&hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    lane: 'global',
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('금리 환율 한국') + '&hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    lane: 'global',
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('관세 한국 경제') + '&hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    lane: 'global',
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('반도체 AI 한국') + '&hl=ko&gl=KR&ceid=KR:ko',
  },
];

const categoryConfig = {
  jobs_housing: {
    topic: '청년 취업과 주거비 부담',
    cover: '[[취업]]도 [[주거비]]도 버겁다',
    sub: '청년층의 출발 비용이 더 커지고 있습니다',
    action: [
      ['취업 준비생', '구직 기간과 현금흐름을 함께 관리하는 전략이 필요합니다.'],
      ['사회초년생', '월세와 관리비 등 고정비 구조부터 먼저 점검해 보세요.'],
      ['정책 체크', '청년 일자리와 주거 지원책이 실제 체감으로 이어지는지 보세요.'],
      ['저장 포인트', '오늘 기사 숫자를 다음 보도와 비교해 보세요.'],
    ],
    tags: ['#청년취업', '#주거비', '#월세', '#생활비'],
  },
  household_debt: {
    topic: '가계부채와 이자 부담 확대',
    cover: '[[빚]] 부담이 [[생활비]]를 누른다',
    sub: '대출과 이자 비용이 소비 여력을 압박하는 흐름입니다',
    action: [
      ['대출 보유자', '변동금리와 상환일정을 먼저 점검하세요.'],
      ['소비 관리', '이자 증가분이 어디서 새는지 고정비부터 보세요.'],
      ['정책 체크', '금리와 채무지원 정책 변화를 같이 살펴보세요.'],
      ['저장 포인트', '기사의 핵심 수치를 다음 보도와 비교해 보세요.'],
    ],
    tags: ['#가계부채', '#대출이자', '#생활비', '#금융'],
  },
  inflation_prices: {
    topic: '생활물가와 소비 부담',
    cover: '[[물가]]가 오르면 [[생활비]]가 흔들린다',
    sub: '장바구니 체감이 다시 커지는지 봐야 합니다',
    action: [
      ['장바구니 비용', '식비와 교통비, 공과금 변화를 따로 체크하세요.'],
      ['고정비 구조', '생활비 증가분이 반복지출인지 확인하세요.'],
      ['정책 체크', '유가와 환율, 금리를 함께 보세요.'],
      ['저장 포인트', '다음 물가 기사와 같은 숫자를 비교해 보세요.'],
    ],
    tags: ['#물가', '#생활비', '#소비', '#장바구니'],
  },
  oil_energy: {
    topic: '국제유가 상승과 생활비 충격',
    cover: '[[유가]]가 오르면 [[생활비]]가 뛴다',
    sub: '국제 변수지만 한국 체감은 빠르게 옵니다',
    action: [
      ['주유·교통비', '유가가 오를 때 가장 먼저 체감되는 항목입니다.'],
      ['장바구니 비용', '운송비가 음식과 생필품 가격에 번지는지 보세요.'],
      ['환율 동반 여부', '유가와 달러가 동시에 오르면 체감이 더 큽니다.'],
      ['저장 포인트', '다음 유가 기사와 숫자 흐름을 비교해 보세요.'],
    ],
    tags: ['#국제유가', '#생활비', '#물가', '#환율'],
  },
  tariffs_trade: {
    topic: '관세·무역 변화와 한국 영향',
    cover: '[[관세]] 변화가 [[한국경제]]를 흔든다',
    sub: '무역 뉴스도 결국 체감 경제 뉴스입니다',
    action: [
      ['수출 업종', '반도체·자동차·배터리 뉴스와 함께 보세요.'],
      ['환율 흐름', '무역 이슈는 환율 변동으로 빠르게 연결될 수 있습니다.'],
      ['생활물가', '수입 원자재 가격이 생활비로 번지는지 보세요.'],
      ['저장 포인트', '다음 통상 기사와 같은 숫자를 비교해 보세요.'],
    ],
    tags: ['#관세', '#수출', '#환율', '#한국경제'],
  },
  ai_semiconductor: {
    topic: 'AI·반도체 경쟁과 한국 산업',
    cover: '[[AI]]와 [[반도체]] 경쟁이 한국을 흔든다',
    sub: '기술 뉴스도 결국 산업과 자산 흐름의 이야기입니다',
    action: [
      ['기술주 보유자', 'AI·반도체 뉴스는 주가 변동성과 함께 보세요.'],
      ['수출 뉴스', '한국 수출 품목 구조와 연결해서 보세요.'],
      ['정책·규제', '정부 지원과 규제 변화를 함께 보세요.'],
      ['저장 포인트', '다음 기술 기사와 같은 숫자를 비교해 보세요.'],
    ],
    tags: ['#AI', '#반도체', '#기술주', '#한국경제'],
  },
  rates_fx: {
    topic: '금리·환율 변화와 자산 영향',
    cover: '[[금리]]와 [[환율]] 변화가 자산을 흔든다',
    sub: '글로벌 뉴스지만 한국 체감은 빠르게 옵니다',
    action: [
      ['대출 보유자', '변동금리와 상환 구조부터 점검하세요.'],
      ['해외투자자', '환율이 수익률에 미치는 영향을 같이 보세요.'],
      ['생활물가', '환율 상승이 수입품 가격에 번지는지 보세요.'],
      ['저장 포인트', '다음 금리 기사와 숫자를 비교해 보세요.'],
    ],
    tags: ['#금리', '#환율', '#달러', '#한국경제'],
  },
  general: {
    topic: '오늘 한국이 봐야 할 핵심 이슈',
    cover: '[[지금]] 한국이 봐야 할 핵심 뉴스',
    sub: '오늘 체감 영향이 큰 이슈를 빠르게 정리했습니다',
    action: [
      ['생활 영향', '생활비와 주거, 취업에 어떤 영향을 줄지 보세요.'],
      ['자산 영향', '금리와 환율, 증시 연결 여부를 확인하세요.'],
      ['정책 변화', '정부 대응과 시장 반응을 같이 보세요.'],
      ['저장 포인트', '다음 뉴스와 핵심 수치를 비교해 보세요.'],
    ],
    tags: ['#오늘의뉴스', '#뉴스요약', '#카드뉴스', '#한국경제'],
  },
};

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return decodeHtml(match?.[1] || '');
}

function parseItems(xml, lane) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const block = match[1];
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    return {
      lane,
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      pubDate: extractTag(block, 'pubDate'),
      description: extractTag(block, 'description'),
      source: decodeHtml(sourceMatch?.[1] || ''),
    };
  });
}

function normalizeTitle(title = '') {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickCategory(text = '') {
  const t = text.toLowerCase();
  if (/(job|employment|hire|youth|wage|housing|rent|home|apartment|monthly rent)/.test(t)) return 'jobs_housing';
  if (/(debt|loan|household|interest|delinquent|default)/.test(t)) return 'household_debt';
  if (/(inflation|consumer|price|cost|food|utility)/.test(t)) return 'inflation_prices';
  if (/(oil|energy|crude|gasoline)/.test(t)) return 'oil_energy';
  if (/(tariff|trade|export|shipment)/.test(t)) return 'tariffs_trade';
  if (/(ai|chip|semiconductor|tech|memory)/.test(t)) return 'ai_semiconductor';
  if (/(rate|fed|exchange|currency|dollar|won)/.test(t)) return 'rates_fx';
  return 'general';
}

function extractMetrics(text = '') {
  const matches =
    text.match(
      /\b\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?(?:\s?billion|\s?million)?|\d+(?:\.\d+)?(?:\s?trillion|\s?billion|\s?million)?\s?(?:won|dollars|barrels)|\d+(?:\.\d+)?(?:년|개월|일|배|만명|명|가구|원|달러|%)/gi,
    ) || [];
  return [...new Set(matches.map((m) => m.trim()))].slice(0, 4);
}

function scoreCandidate(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = item.lane === 'domestic' ? 8 : 6;
  const groups = [
    [/job|employment|hire|housing|rent|debt|loan|interest|inflation|price|oil|gasoline|tariff|trade|ai|semiconductor|rate|exchange|won|dollar/g, 3],
    [/young|youth|household|consumer|salary|wage/g, 4],
    [/korea|korean/g, 2],
  ];
  for (const [regex, weight] of groups) {
    const hits = text.match(regex);
    if (hits) score += hits.length * weight;
  }
  score += extractMetrics(text).length * 2;
  const ageHours = Math.max(0, (Date.now() - new Date(item.pubDate || Date.now()).getTime()) / 36e5);
  score += Math.max(0, 18 - ageHours) * 0.4;
  return Number(score.toFixed(2));
}

function titleSummary(title = '') {
  return title
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+\|\s+.*$/, '')
    .trim();
}

function toImpactItems(category, metrics, description) {
  const a = metrics[0] || '핵심 수치';
  const b = metrics[1] || '보조 수치';
  const c = metrics[2] || '추가 변수';
  const copy = {
    jobs_housing: [
      ['취업 지연', '구직 공백이 길수록 소득 회복이 더디게 진행됩니다.'],
      ['주거 압박', '월세와 보증금 부담이 고정비를 빠르게 키웁니다.'],
      ['생활비 압박', '생활비까지 겹치면 저축 여력이 더 줄어듭니다.'],
      ['정책 변수', '일자리와 주거 지원이 함께 작동해야 체감이 납니다.'],
    ],
    household_debt: [
      ['대출 부담', '원금과 이자 부담이 동시에 체감될 수 있습니다.'],
      ['소비 여력', '이자 비용이 늘면 소비와 저축 여력이 줄어듭니다.'],
      ['취약 가구', '소득이 흔들리면 충격이 더 빨리 전이될 수 있습니다.'],
      ['정책 변수', '금리와 채무지원 정책 변화가 중요합니다.'],
    ],
    inflation_prices: [
      ['소비 압박', '식비와 교통비, 공과금이 함께 움직일 수 있습니다.'],
      ['실질소득', '소득이 같아도 체감 구매력은 줄 수 있습니다.'],
      ['저축 여력', '고정비가 늘면 방어력이 약해집니다.'],
      ['정책 변수', '유가와 환율, 금리를 함께 봐야 합니다.'],
    ],
    oil_energy: [
      ['교통비', '유가 상승은 먼저 주유비 체감으로 나타납니다.'],
      ['물가 전이', '운송비가 장바구니 가격으로 번질 수 있습니다.'],
      ['환율 변수', '달러 강세와 겹치면 수입 부담이 커집니다.'],
      ['산업 영향', '항공·물류·제조 업종에 먼저 충격이 갑니다.'],
    ],
    tariffs_trade: [
      ['수출 기업', '가격 경쟁력과 실적 전망에 영향을 줄 수 있습니다.'],
      ['환율 변수', '무역 불확실성은 환율 변동성을 키울 수 있습니다.'],
      ['국내 물가', '수입 비용 변화가 생활물가로 번질 수 있습니다.'],
      ['정책 대응', '통상 전략과 대응 속도가 중요합니다.'],
    ],
    ai_semiconductor: [
      ['수출 구조', '반도체 뉴스는 한국 수출과 증시에 직결됩니다.'],
      ['투자 심리', '기술주 변동성을 키울 수 있는 뉴스입니다.'],
      ['산업 전략', '공급망과 규제, 투자 속도를 함께 봐야 합니다.'],
      ['고용 파급', '설비투자와 업황은 일자리에도 연결됩니다.'],
    ],
    rates_fx: [
      ['대출 부담', '금리 변화는 대출자 부담으로 빠르게 연결됩니다.'],
      ['환율 영향', '달러 강세는 수입물가와 투자 체감에 영향을 줍니다.'],
      ['증시 반응', '기술주·성장주 변동성이 커질 수 있습니다.'],
      ['생활비 전이', '환율 상승은 수입품 가격에도 영향을 줍니다.'],
    ],
    general: [
      ['핵심 배경', description || '오늘 가장 넓게 영향을 주는 이슈입니다.'],
      ['연결 수치', '기사의 핵심 데이터와 흐름을 함께 보세요.'],
      ['시장 변수', '체감 영향이 커질 수 있는 변수를 보세요.'],
      ['체감 포인트', '한국 팔로워 기준으로 읽어야 할 뉴스입니다.'],
    ],
  }[category] || [];

  return copy.map(([label, desc], index) => ({
    label,
    value: [a, b, c, '체감 영향'][index] || '핵심 포인트',
    desc,
  }));
}

async function getPublishedHistory() {
  try {
    const res = await fetch(historyUrl, {
      headers: { 'x-automation-token': triggerToken },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

async function fetchCandidates() {
  const all = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'user-agent': 'n8n-instagram-news-bot/1.0' },
      });
      if (!res.ok) continue;
      all.push(...parseItems(await res.text(), feed.lane).slice(0, 5));
    } catch {
      continue;
    }
  }

  const dedup = new Map();
  for (const item of all) {
    const key = `${normalizeTitle(item.title)}|${item.source}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }
  return [...dedup.values()];
}

const published = await getPublishedHistory();
const publishedUrls = new Set(published.map((x) => x.sourceUrl).filter(Boolean));
const publishedTitles = new Set(published.map((x) => normalizeTitle(x.sourceTitle || x.topic || '')).filter(Boolean));

const scored = (await fetchCandidates())
  .map((item) => ({ ...item, score: scoreCandidate(item) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 6);

const filtered = scored.filter((item) => {
  if (publishedUrls.has(item.link)) return false;
  if (publishedTitles.has(normalizeTitle(item.title))) return false;
  return true;
});

if (!filtered.length) {
  throw new Error('발행 가능한 새 기사 후보를 찾지 못했습니다.');
}

const selected = filtered[0];
const category = pickCategory(`${selected.title} ${selected.description}`);
const config = categoryConfig[category] || categoryConfig.general;
const metrics = extractMetrics(`${selected.title} ${selected.description}`);
const mainTitle = titleSummary(selected.title);
const summary = selected.description || '한국 체감 영향이 큰 오늘의 이슈입니다.';
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

return [
  {
    json: {
      topic: config.topic,
      sourceUrl: selected.link,
      sourceTitle: selected.title,
      caption: `${config.topic}\n\n${mainTitle}\n\n💾 저장해두고 나중에 다시 보세요!\n👉 팔로우하면 매일 뉴스 카드뉴스 받아요\n\n${config.tags.join(' ')}`,
      selectionCandidates: scored.map((item) => ({
        title: item.title,
        link: item.link,
        source: item.source,
        lane: item.lane,
        score: item.score,
      })),
      data: {
        date: today,
        topic: config.topic,
        caption: `${config.topic} 핵심 요약`,
        cards: [
          {
            type: 'cover',
            eyebrow: selected.lane === 'global' ? '글로벌 시사 브리핑' : '국내 시사 브리핑',
            headline_main: config.cover,
            headline_sub: config.sub,
            summary,
            hashtags: config.tags,
          },
          {
            type: 'stats',
            eyebrow: '핵심 팩트',
            title: '숫자로 보면 더 선명한 포인트',
            hero: {
              label: '가장 먼저 볼 숫자',
              title: metrics[0] || '핵심 수치',
              desc: '기사와 한국 체감 영향을 연결하는 기준선입니다.',
            },
            items: [
              { label: '기사 출처', value: selected.source || '한국 뉴스', desc: '후보 기사 중 체감 영향이 큰 이슈를 선택했습니다.' },
              { label: '기사 시점', value: selected.pubDate ? selected.pubDate.slice(0, 16) : '최신', desc: '최근성을 우선해 후보를 추렸습니다.' },
              { label: '보조 수치', value: metrics[1] || metrics[0] || '핵심 수치', desc: '기사 설명에서 함께 잡힌 보조 지표입니다.' },
              { label: '추가 변수', value: metrics[2] || '체감 변수', desc: '후속 기사와 비교할 때 쓸 기준선입니다.' },
            ],
          },
          {
            type: 'impact',
            eyebrow: '배경·원인',
            title: '왜 지금 더 중요할까',
            items: toImpactItems(category, metrics, summary),
          },
          {
            type: 'causes',
            eyebrow: '상세 흐름',
            title: '기사 핵심을 3단계로 보면',
            items: [
              { label: '현재 수치', value: metrics[0] || '핵심 수치', desc: '이번 기사에서 가장 먼저 봐야 할 기준선입니다.' },
              { label: '연결 수치', value: metrics[1] || metrics[0] || '보조 수치', desc: '흐름을 읽는 데 필요한 연결 지표입니다.' },
              { label: '다음 변수', value: metrics[2] || '추가 변수', desc: '앞으로 지켜볼 시장·정책 변수입니다.' },
            ],
            warning: '핵심은 숫자 자체보다 한국 생활과 자산에 어떻게 번지는지입니다.',
          },
          {
            type: 'action',
            eyebrow: '영향·대응',
            title: '지금 체크할 포인트',
            items: config.action.map(([label, desc]) => ({ label, desc })),
            closing: '뉴스는 숫자와 체감 영향을 함께 볼 때 더 잘 읽힙니다.',
          },
          {
            type: 'closing',
            title: `[[핵심 숫자]]와 [[체감 영향]]을 같이 봐야 합니다`,
            summary: `${mainTitle}. 핵심은 ${metrics[0] || '핵심 수치'}, ${metrics[1] || '보조 수치'}, ${metrics[2] || '추가 변수'}입니다.`,
            cta: '저장해두고 다음 기사와 숫자 변화를 비교해 보세요.',
            hashtags: config.tags,
          },
        ],
      },
    },
  },
];
