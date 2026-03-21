const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '20mb' }));

let sharedBrowser;

async function graphRequest(path, params) {
  const response = await fetch(`https://graph.instagram.com/v25.0/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload?.error?.message || `Instagram request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function graphGet(path, query) {
  const url = new URL(`https://graph.instagram.com/v25.0/${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), { method: 'GET' });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload?.error?.message || `Instagram GET failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCreationId(mediaId, accessToken, attempts = 15, delayMs = 4000) {
  let lastStatus = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const payload = await graphGet(mediaId, {
      fields: 'status_code,status',
      access_token: accessToken
    });

    const statusCode = payload.status_code || payload.status || null;
    lastStatus = statusCode;

    if (statusCode === 'FINISHED' || statusCode === 'PUBLISHED') {
      return { ready: true, status: statusCode, attempts: attempt };
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new Error(`Instagram media processing failed with status ${statusCode}`);
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  return { ready: false, status: lastStatus, attempts };
}

async function uploadToImgBB(base64Image, apiKey, name) {
  const params = new URLSearchParams();
  params.append('key', apiKey);
  params.append('image', base64Image);
  if (name) {
    params.append('name', name);
  }

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`imgBB upload failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.success || !payload.data?.url) {
    throw new Error(payload.error?.message || 'imgBB upload failed');
  }

  return {
    id: payload.data.id,
    url: payload.data.url,
    deleteUrl: payload.data.delete_url
  };
}

async function createInstagramCarousel({
  igUserId,
  accessToken,
  imageUrls,
  caption = '',
  publish = true
}) {
  if (!igUserId) {
    throw new Error('igUserId is required for Instagram publishing');
  }
  if (!accessToken) {
    throw new Error('instagramAccessToken is required for Instagram publishing');
  }
  if (!Array.isArray(imageUrls) || imageUrls.length < 2) {
    throw new Error('At least 2 image URLs are required to create a carousel');
  }

  const mediaItems = await Promise.all(
    imageUrls.map((imageUrl) =>
      graphRequest(`${igUserId}/media`, {
        image_url: imageUrl,
        is_carousel_item: 'true',
        access_token: accessToken
      })
    )
  );

  const children = mediaItems.map((media) => media.id);

  const carousel = await graphRequest(`${igUserId}/media`, {
    media_type: 'CAROUSEL',
    caption,
    children: children.join(','),
    access_token: accessToken
  });

  let published = null;
  if (publish) {
    const readiness = await waitForCreationId(carousel.id, accessToken);
    if (!readiness.ready) {
      throw new Error(`Media ID is not available yet (last status: ${readiness.status || 'unknown'})`);
    }

    published = await graphRequest(`${igUserId}/media_publish`, {
      creation_id: carousel.id,
      access_token: accessToken
    });
  }

  return {
    children,
    carouselId: carousel.id,
    publishId: published?.id || null,
    published: Boolean(published)
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

function stripCodeFence(value = '') {
  return String(value || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parsePayload(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return JSON.parse(stripCodeFence(raw));
  }
  return raw;
}

function mapStatsItems(items = []) {
  return items.slice(0, 3).map((item, index) => ({
    ico: ['', '', ''][index] || '',
    label: item.label || '',
    val: item.value || item.val || '',
    desc: item.desc || '',
    amber: index === 2,
    highlight: index < 2
  }));
}

function mapImpactItems(items = []) {
  return items.slice(0, 3).map((item) => ({
    ico: item.ico || '',
    title: [item.label, item.value].filter(Boolean).join(' '),
    desc: item.desc || ''
  }));
}

function mapCauseItems(items = []) {
  return items.slice(0, 3).map((item, index) => ({
    title: item.value || item.label || '',
    desc: [item.label && item.value ? `${item.label} - ` : item.label && !item.value ? `${item.label} - ` : '', item.desc || '']
      .join('')
      .trim(),
    highlight: index < 2
  }));
}

function mapActionItems(items = []) {
  return items.slice(0, 4).map((item) => ({
    ico: item.ico || '',
    title: item.label || '',
    desc: item.desc || ''
  }));
}

function normalizeData(rawData) {
  const parsed = parsePayload(rawData);
  if (!parsed) {
    throw new Error('data field is required');
  }

  if (Array.isArray(parsed.cards)) {
    const byType = Object.fromEntries(parsed.cards.map((card) => [card.type, card]));
    const cover = byType.cover || {};
    const stats = byType.stats || {};
    const impact = byType.impact || {};
    const causes = byType.causes || {};
    const action = byType.action || {};
    const closing = byType.closing || {};

    return {
      date: parsed.date,
      topic: parsed.topic || '',
      caption: parsed.caption || '',
      card1: {
        eyebrow: cover.eyebrow || parsed.topic || '',
        hero: cover.headline_main || '',
        hero2: cover.headline_sub || '',
        sub: cover.summary || '',
        chips: cover.hashtags || []
      },
      card2: {
        badge: stats.eyebrow || '',
        title: stats.title || '',
        items: mapStatsItems(stats.items)
      },
      card3: {
        badge: impact.eyebrow || '',
        title: impact.title || '',
        items: mapImpactItems(impact.items)
      },
      card4: {
        badge: causes.eyebrow || '',
        title: causes.title || '',
        items: mapCauseItems(causes.items),
        warning: causes.warning || ''
      },
      card5: {
        badge: action.eyebrow || '',
        title: action.title || '',
        items: mapActionItems(action.items),
        quote: action.closing || ''
      },
      card6: {
        ico: closing.ico || '',
        title: closing.title || '',
        desc: [closing.summary, closing.cta].filter(Boolean).join('\n\n'),
        tags: closing.hashtags || []
      }
    };
  }

  return parsed;
}

async function getBrowser() {
  if (sharedBrowser) {
    return sharedBrowser;
  }

  sharedBrowser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  return sharedBrowser;
}

function buildHTML(d) {
  const today = d.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const br = (value = '') => String(value || '').replace(/\n/g, '<br>');
  const chips = (arr = []) => arr.map((c) => `<div class="chip">${c}</div>`).join('');
  const ctags = (arr = []) => arr.map((c) => `<div class="ctag">${c}</div>`).join('');
  const statItems = (arr = []) => arr.map((i) => `
    <div class="si${i.highlight ? ' hi' : ''}">
      <div class="si-ico">${i.ico || ''}</div>
      <div>
        <div class="si-lbl">${i.label || ''}</div>
        <div class="si-val${i.amber ? ' a' : ''}">${i.val || ''}</div>
        <div class="si-desc">${br(i.desc || '')}</div>
      </div>
    </div>`).join('');
  const impactItems = (arr = []) => arr.map((i, idx) => `
    <div class="ii${idx === 0 ? ' feature' : ''}">
      <div class="ii-ico-wrap"><div class="ii-ico">${i.ico || ''}</div></div>
      <div>
        <div class="ii-t">${i.title || ''}</div>
        <div class="ii-d">${br(i.desc || '')}</div>
      </div>
    </div>`).join('');
  const causeItems = (arr = []) => arr.map((i, idx) => `
    <div class="ci${i.highlight || idx < 2 ? ' hi' : ''}${idx === 0 ? ' feature' : ''}">
      <div class="c-n-wrap"><div class="c-n">${i.title ? (i.title.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u)?.[0] || idx + 1) : idx + 1}</div></div>
      <div>
        <div class="c-t">${i.title || ''}</div>
        <div class="c-d">${br(i.desc || '')}</div>
      </div>
    </div>`).join('');
  const actionItems = (arr = []) => arr.map((i, idx) => `
    <div class="ai${idx === 0 ? ' feature' : ''}">
      <div class="a-ico-wrap"><div class="a-ico">${i.ico || ''}</div></div>
      <div>
        <div class="a-t">${i.title || ''}</div>
        <div class="a-d">${br(i.desc || '')}</div>
      </div>
    </div>`).join('');
  const footer = (num) => `
    <div class="bb">
      <span class="bb-name">TODAY BRIEF</span>
      <span class="bb-no">${String(num).padStart(2, '0')} / 06</span>
      <span class="bb-date">${today}</span>
    </div>`;

  const c1 = d.card1 || { eyebrow: '', hero: '', hero2: '', sub: '', chips: [] };
  const c2 = d.card2 || { badge: '', title: '', items: [] };
  const c3 = d.card3 || { badge: '', title: '', items: [] };
  const c4 = d.card4 || { badge: '', title: '', items: [], warning: '' };
  const c5 = d.card5 || { badge: '', title: '', items: [], quote: '' };
  const c6 = d.card6 || { ico: '', title: '', desc: '', tags: [] };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Color+Emoji&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --font:'Noto Sans KR','Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji','Malgun Gothic','Apple SD Gothic Neo','Nanum Gothic',sans-serif;
  --font-display:'Black Han Sans','Noto Sans KR','Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji','Malgun Gothic','Apple SD Gothic Neo','Nanum Gothic',sans-serif;
  --a:#f59e0b;--r:#ef4444;--g:#22c55e;
  --bg:#111827;--bo:rgba(255,255,255,0.08);--t:#fff;
  --m:rgba(255,255,255,0.58);--m2:rgba(255,255,255,0.78);
  --W:1600px;--H:2000px;
  --fs-hero:240px;--fs-h1:116px;--fs-h2:84px;--fs-h3:58px;
  --fs-body:44px;--fs-small:36px;--fs-label:30px;--fs-brand:26px
}
body{background:#080c14;font-family:var(--font);padding:80px 32px;display:flex;flex-direction:column;align-items:center;gap:80px}
.card{width:var(--W);height:var(--H);background:var(--bg);border-radius:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 100px rgba(0,0,0,0.85);font-family:var(--font)}
.bb{position:absolute;bottom:0;left:0;right:0;padding:40px 72px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--bo);background:rgba(0,0,0,0.6);z-index:10}
.bb-name{font-size:var(--fs-brand);font-weight:800;color:var(--r);letter-spacing:2.5px;text-transform:uppercase}
.bb-date{font-size:var(--fs-brand);color:var(--m);font-weight:500}
.bb-no{font-size:32px;font-weight:800;color:var(--m);letter-spacing:1px}
.badge{display:inline-block;font-size:var(--fs-label);font-weight:800;letter-spacing:1px;padding:16px 32px;border-radius:999px;text-transform:uppercase;margin-bottom:32px}
.badge.red{background:var(--r);color:#fff}.badge.amb{background:var(--a);color:#000}.badge.grn{background:var(--g);color:#000}
.ctitle{font-size:var(--fs-h1);font-weight:900;color:var(--t);line-height:1.22;margin-bottom:44px;word-break:keep-all;letter-spacing:-0.03em}
.ctitle em{color:var(--r);font-style:normal}.ctitle em.a{color:var(--a)}
.c1{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;padding:104px 112px 176px}
.c1 .g1{position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.25) 0%,transparent 62%);top:-220px;right:-200px}
.c1 .grid,.c6 .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px);background-size:100px 100px}
.c1 .inner,.c6 .inner{position:relative;z-index:1}
.c1 .eyebrow{display:inline-flex;align-items:center;gap:14px;padding:16px 24px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.08);border-radius:999px;color:#fcd34d;font-size:28px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:32px}
.c1 .eyebrow::before{content:'';width:10px;height:10px;border-radius:50%;background:var(--a);box-shadow:0 0 18px rgba(245,158,11,0.8)}
.c1 .hero{font-family:var(--font-display);font-size:var(--fs-hero);font-weight:400;color:#ff5a5a;line-height:0.92;letter-spacing:-3px;margin-bottom:18px;text-shadow:0 0 100px rgba(239,68,68,0.55)}
.c1 .hero2{font-size:112px;font-weight:900;color:var(--t);line-height:1.1;margin-bottom:42px;word-break:keep-all;letter-spacing:-0.04em;max-width:1200px}
.c1 .hero2 em{color:var(--a);font-style:normal}
.c1 .bar{width:168px;height:12px;background:linear-gradient(90deg,var(--r),var(--a));border-radius:6px;margin-bottom:40px}
.c1 .sub{font-size:var(--fs-body);color:var(--m2);line-height:1.72;margin-bottom:48px;font-weight:600;word-break:keep-all;max-width:1160px}
.chips,.ctags{display:flex;gap:16px;flex-wrap:wrap}
.chip{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:var(--m2);font-size:var(--fs-label);font-weight:700;padding:14px 24px;border-radius:99px}
.c2,.c3,.c4,.c5{padding:92px 96px 176px}
.c3,.c4,.c5{padding:74px 88px 176px}
.c3 .ctitle,.c4 .ctitle,.c5 .ctitle{font-size:96px;line-height:1.14;margin-bottom:26px;max-width:1260px}
.slist,.ilist,.clist,.alist{display:flex;flex-direction:column;flex:1;justify-content:center}
.slist{gap:28px}.ilist{gap:24px}.clist{gap:28px}.alist{gap:26px}
.c3 .ilist,.c4 .clist,.c5 .alist{justify-content:flex-start;padding-top:8px}
.si,.ii,.ci,.ai{border-radius:16px;border:1px solid var(--bo);background:rgba(255,255,255,0.03)}
.si{padding:36px 40px;display:flex;align-items:center;gap:24px}
.si.hi{background:rgba(239,68,68,0.07);border-color:rgba(239,68,68,0.25)}
.si-ico{font-size:48px;flex-shrink:0;min-width:60px}
.si-lbl{font-size:var(--fs-label);font-weight:700;color:var(--m);margin-bottom:10px}
.si-val{font-size:var(--fs-h2);font-weight:900;color:var(--r);line-height:1.1}
.si-val.a{color:var(--a)}
.si-desc{font-size:var(--fs-small);color:var(--m);margin-top:10px;font-weight:500;word-break:keep-all;line-height:1.6}
.ii{padding:40px 42px;display:flex;gap:24px;align-items:flex-start;min-height:250px}
.ii.feature,.ci.feature,.ai.feature{background:rgba(255,255,255,0.06);border-color:rgba(245,158,11,0.18)}
.ii-ico-wrap,.c-n-wrap,.a-ico-wrap{width:96px;min-width:96px;height:96px;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06));display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08)}
.ii-ico{font-size:54px;line-height:1}
.ii-t{font-size:70px;font-weight:900;color:var(--t);margin-bottom:10px;line-height:1.12;word-break:keep-all;letter-spacing:-0.035em}
.ii-d{font-size:38px;color:var(--m2);line-height:1.46;font-weight:600;word-break:keep-all}
.ci{padding:40px 42px;display:flex;gap:24px;align-items:flex-start;min-height:250px}
.ci.hi{border-color:rgba(239,68,68,0.28);background:rgba(239,68,68,0.05)}
.c-n{width:72px;height:72px;border-radius:20px;background:rgba(239,68,68,0.12);color:#fff;font-size:42px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1}
.c-t{font-size:72px;font-weight:900;color:var(--t);margin-bottom:10px;line-height:1.1;word-break:keep-all;letter-spacing:-0.04em}
.c-d{font-size:38px;color:var(--m2);line-height:1.46;font-weight:600;word-break:keep-all}
.ws{background:rgba(245,158,11,0.08);border-left:5px solid var(--a);border-radius:0 12px 12px 0;padding:24px 28px;font-size:30px;color:#fde68a;line-height:1.65;font-weight:500;word-break:keep-all;margin-top:8px}
.ws strong{color:var(--a);font-weight:900}
.ai{padding:40px 42px;display:flex;gap:24px;align-items:flex-start;min-height:224px}
.a-ico{font-size:54px;line-height:1}
.a-t{font-size:72px;font-weight:900;color:var(--t);margin-bottom:10px;line-height:1.1;word-break:keep-all;letter-spacing:-0.04em}
.a-d{font-size:38px;color:var(--m2);line-height:1.46;font-weight:600;word-break:keep-all}
.gq{background:rgba(34,197,94,0.07);border-left:5px solid var(--g);border-radius:0 12px 12px 0;padding:24px 28px;font-size:30px;color:#86efac;line-height:1.65;margin-top:12px;font-weight:600;word-break:keep-all}
.c6{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;align-items:center;text-align:center;padding:104px 112px 176px}
.c6 .g1{position:absolute;width:650px;height:650px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.18) 0%,transparent 62%);top:-200px;left:50%;transform:translateX(-50%)}
.c6 .inner{display:flex;flex-direction:column;align-items:center}
.c6 .ico{font-size:96px;margin-bottom:40px}
.c6 .ft{font-size:108px;font-weight:900;color:var(--t);line-height:1.24;margin-bottom:32px;word-break:keep-all}
.c6 .ft em{color:var(--r);font-style:normal}
.c6 .fd{font-size:42px;color:var(--m);line-height:1.8;margin-bottom:44px;font-weight:500;word-break:keep-all}
.c6 .fd strong{color:var(--a);font-weight:900}
.ctag{background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;font-size:var(--fs-label);font-weight:700;padding:14px 28px;border-radius:99px}
.c6 .ico,.c6 .ft,.c6 .fd,.ctag,.chip,.si-lbl,.si-val,.si-desc,.ii-t,.ii-d,.c-t,.c-d,.a-t,.a-d{font-family:var(--font)}
</style>
</head>
<body>

<div class="card c1" id="card-1">
  <div class="g1"></div><div class="grid"></div>
  <div class="inner">
    <div class="eyebrow">${c1.eyebrow || ''}</div>
    <div class="hero">${c1.hero}</div>
    <div class="hero2">${br(c1.hero2 || '')}</div>
    <div class="bar"></div>
    <div class="sub">${br(c1.sub || '')}</div>
    <div class="chips">${chips(c1.chips)}</div>
  </div>
  ${footer(1)}
</div>

<div class="card c2" id="card-2">
  <div class="badge red">${c2.badge}</div>
  <div class="ctitle">${br(c2.title || '')}</div>
  <div class="slist">${statItems(c2.items)}</div>
  ${footer(2)}
</div>

<div class="card c3" id="card-3">
  <div class="badge red">${c3.badge}</div>
  <div class="ctitle">${br(c3.title || '')}</div>
  <div class="ilist">${impactItems(c3.items)}</div>
  ${footer(3)}
</div>

<div class="card c4" id="card-4">
  <div class="badge red">${c4.badge}</div>
  <div class="ctitle">${br(c4.title || '')}</div>
  <div class="clist">${causeItems(c4.items)}</div>
  <div class="ws">${c4.warning || ''}</div>
  ${footer(4)}
</div>

<div class="card c5" id="card-5">
  <div class="badge grn">${c5.badge}</div>
  <div class="ctitle">${br(c5.title || '')}</div>
  <div class="alist">${actionItems(c5.items)}</div>
  <div class="gq">${c5.quote || ''}</div>
  ${footer(5)}
</div>

<div class="card c6" id="card-6">
  <div class="g1"></div><div class="grid"></div>
  <div class="inner">
    <div class="ico">${c6.ico}</div>
    <div class="ft">${br(c6.title || '')}</div>
    <div class="fd">${br(c6.desc || '')}</div>
    <div class="ctags">${ctags(c6.tags)}</div>
  </div>
  ${footer(6)}
</div>

</body>
</html>`;
}

app.post('/generate', async (req, res) => {
  const {
    data,
    imgbbKey,
    instagramAccessToken,
    instagramUserId,
    caption,
    publishToInstagram = false,
    includeDebugAssets = false
  } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'data field is required' });
  }

  try {
    const startedAt = Date.now();
    console.log('[generate] request received');
    const normalized = normalizeData(data);
    console.log('[generate] payload normalized');

    const browser = await getBrowser();
    console.log('[generate] browser ready');
    const page = await browser.newPage();
    await page.setViewport({ width: 1800, height: 14000, deviceScaleFactor: 1 });

    const html = buildHTML(normalized);

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise((r) => setTimeout(r, 400));

    const images = [];
    for (let i = 1; i <= 6; i += 1) {
      const el = await page.$(`#card-${i}`);
      if (!el) {
        throw new Error(`card-${i} element not found`);
      }

      const screenshot = await el.screenshot({ type: 'png' });
      images.push(screenshot.toString('base64'));
    }

    await page.close();

    const effectiveImgBBKey = imgbbKey || process.env.IMGBB_API_KEY;
    let uploads = [];
    let urls = [];
    let instagram = null;

    if (effectiveImgBBKey) {
      console.log('[generate] uploading images to imgBB');
      uploads = await Promise.all(
        images.map((image, index) =>
          uploadToImgBB(image, effectiveImgBBKey, `card-${index + 1}-${Date.now()}`)
        )
      );
      urls = uploads.map((item) => item.url);
    }

    if (publishToInstagram) {
      console.log('[generate] creating Instagram carousel');
      instagram = await createInstagramCarousel({
        igUserId: instagramUserId || process.env.INSTAGRAM_USER_ID,
        accessToken: instagramAccessToken || process.env.INSTAGRAM_ACCESS_TOKEN,
        imageUrls: urls,
        caption: caption || normalized.caption || '',
        publish: true
      });
    }

    console.log(`[generate] response sent in ${Date.now() - startedAt}ms`);
    const response = {
      count: images.length,
      uploaded: urls.length,
      instagram
    };

    if (includeDebugAssets) {
      response.images = images;
      response.urls = urls;
      response.uploads = uploads;
      response.html = html;
    } else {
      response.urls = urls;
      response.uploads = uploads;
    }

    res.json(response);
  } catch (err) {
    console.error('[generate] error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server listening on port ${PORT}`));
