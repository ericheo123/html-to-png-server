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
    url: payload.data.image?.url || payload.data.url,
    deleteUrl: payload.data.delete_url
  };
}

async function ensureImageUrl(url) {
  const methods = ['HEAD', 'GET'];

  for (const method of methods) {
    try {
      const response = await fetch(url, {
        method,
        headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        return true;
      }
    } catch (err) {
      continue;
    }
  }

  throw new Error(`Instagram image_url is not a direct image: ${url}`);
}

async function ensureImageUrls(urls = []) {
  for (const url of urls) {
    await ensureImageUrl(url);
  }
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

  await ensureImageUrls(imageUrls);

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

function iconCandidates(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  if (/자동차|차량|모빌리티/.test(text)) return ['🚗', '🚙', '🛻'];
  if (/철강|알루미늄|공장|제조/.test(text)) return ['🏭', '⚙️', '🧱'];
  if (/주식|코스피|증시|투자/.test(text)) return ['📈', '💹', '📊'];
  if (/환율|달러|원화|무역/.test(text)) return ['💱', '💵', '🌍'];
  if (/수출/.test(text)) return ['📦', '🚢', '💱'];
  if (/물가|장바구니|식재료|수입품/.test(text)) return ['🛒', '🥖', '🧺'];
  if (/기름|유가|전기|에너지/.test(text)) return ['⛽', '⚡', '🛢️'];
  if (/여행|항공|해외직구|직구/.test(text)) return ['✈️', '🧳', '🌐'];
  if (/금리|대출|이자|은행/.test(text)) return ['🏦', '💳', '🏠'];
  if (/공급망|재편|생산/.test(text)) return ['🔗', '🏗️', '📦'];
  if (/트럼프|재집권|정책|행정부|의회|정부/.test(text)) return ['🏛️', '🧾', '⚖️'];
  if (/원인|배경/.test(text)) return ['🧾', '🔎', '📌'];
  if (/확인|체크|주목/.test(text)) return ['✅', '👀', '📍'];
  return ['📌', '✨', '🔹'];
}

function inferIcon(...values) {
  return iconCandidates(...values)[0];
}

function pickUniqueIcons(items = [], resolver, fallbackIcons = []) {
  const used = new Set();

  return items.map((item, index) => {
    const candidates = [...iconCandidates(item?.label, item?.value, item?.desc), ...fallbackIcons];

    const choice =
      candidates.find((candidate) => candidate && !used.has(candidate)) ||
      candidates.find(Boolean) ||
      fallbackIcons.find((candidate) => candidate && !used.has(candidate)) ||
      fallbackIcons[0] ||
      resolver(item, index);

    used.add(choice);
    return choice;
  });
}

function highlightText(value = '') {
  const text = String(value || '');
  if (!text) return '';
  let count = 0;
  return text.replace(/\[\[(.+?)\]\]/g, (_, inner) => {
    if (inner.length > 12) {
      return inner;
    }
    if (count >= 2) {
      return inner;
    }
    count += 1;
    return `<em class="hl">${inner}</em>`;
  });
}

function normalizeStats(stats = {}) {
  const items = Array.isArray(stats.items) ? stats.items : [];
  const hero = stats.hero;

  if (hero) {
    return {
      hero: {
        label: hero.label || '',
        title: hero.title || hero.value || hero.val || '',
        desc: hero.desc || ''
      },
      items: items.slice(0, 3)
    };
  }

  return {
    hero: {
      label: items[0]?.label || '',
      title: items[0]?.value || items[0]?.val || '',
      desc: items[0]?.desc || ''
    },
    items: items.slice(1, 4)
  };
}

function mapStatsItems(items = []) {
  const rows = items.slice(0, 3);
  const icons = pickUniqueIcons(rows, () => '📌', ['📘', '📈', '🚨', '🧭']);

  return rows.map((item, index) => ({
    ico: icons[index] || '',
    label: item.label || '',
    val: item.value || item.val || '',
    desc: item.desc || '',
    amber: index === 2,
    highlight: index < 2
  }));
}

function mapImpactItems(items = []) {
  const rows = items.slice(0, 4);
  const icons = pickUniqueIcons(rows, () => '📌', ['🛒', '⛽', '✈️', '🏦', '📦', '💱']);

  return rows.map((item, index) => ({
    ico: icons[index] || inferIcon(item.label, item.value, item.desc),
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
  const rows = items.slice(0, 4);
  const icons = pickUniqueIcons(rows, () => '✅', ['💵', '✈️', '🏠', '📊', '🛒']);

  return rows.map((item, index) => ({
    ico: icons[index] || inferIcon(item.label, item.desc),
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
    const normalizedStats = normalizeStats(stats);
    const fallbackMain =
      cover.headline_main ||
      parsed.topic ||
      stats.title ||
      impact.title ||
      '오늘의 이슈';
    const fallbackSub =
      cover.headline_sub ||
      cover.summary ||
      parsed.topic ||
      '지금 꼭 알아야 할 핵심만 정리했어요';

    return {
      date: parsed.date,
      topic: parsed.topic || '',
      caption: parsed.caption || '',
      card1: {
        eyebrow: cover.eyebrow || parsed.topic || '',
        hero: fallbackMain,
        hero2: fallbackSub === fallbackMain ? (cover.summary || '지금 꼭 알아야 할 핵심만 정리했어요') : fallbackSub,
        sub: cover.summary || '',
        chips: cover.hashtags || []
      },
      card2: {
        badge: stats.eyebrow || '',
        title: stats.title || '',
        hero: normalizedStats.hero,
        items: mapStatsItems(normalizedStats.items)
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

  throw new Error('Invalid cards structure');
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
        <div class="si-val${i.amber ? ' a' : ''}">${highlightText(i.val || '')}</div>
        <div class="si-desc">${highlightText(br(i.desc || ''))}</div>
      </div>
    </div>`).join('');
  const impactItems = (arr = []) => arr.map((i, idx) => `
    <div class="ii${idx === 0 ? ' feature' : ''}">
      <div class="ii-ico-wrap"><div class="ii-ico">${i.ico || '📌'}</div></div>
      <div>
        <div class="ii-t">${highlightText(i.title || '')}</div>
        <div class="ii-d">${highlightText(br(i.desc || ''))}</div>
      </div>
    </div>`).join('');
  const causeItems = (arr = []) => arr.map((i, idx) => `
    <div class="ci${i.highlight || idx < 2 ? ' hi' : ''}${idx === 0 ? ' feature' : ''}">
      <div class="c-n-wrap"><div class="c-n">${i.title ? (i.title.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u)?.[0] || idx + 1) : idx + 1}</div></div>
      <div>
        <div class="c-t">${highlightText(i.title || '')}</div>
        <div class="c-d">${highlightText(br(i.desc || ''))}</div>
      </div>
    </div>`).join('');
  const actionItems = (arr = []) => arr.map((i, idx) => `
    <div class="ai${idx === 0 ? ' feature' : ''}">
      <div class="a-ico-wrap"><div class="a-ico">${i.ico || '✅'}</div></div>
      <div>
        <div class="a-t">${highlightText(i.title || '')}</div>
        <div class="a-d">${highlightText(br(i.desc || ''))}</div>
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
  const c2Lead = c2.hero || { label: '', title: '', desc: '' };
  const c2Rest = c2.items || [];
  const warningBlock = c4.warning ? `<div class="ws">${c4.warning}</div>` : '';
  const quoteBlock = c5.quote ? `<div class="gq">${c5.quote}</div>` : '';

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
body{background:#080c14;font-family:var(--font);padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:56px}
.card{width:var(--W);height:var(--H);background:var(--bg);border-radius:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 100px rgba(0,0,0,0.85);font-family:var(--font)}
.bb{position:absolute;bottom:0;left:0;right:0;padding:28px 56px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--bo);background:rgba(0,0,0,0.62);z-index:10}
.bb-name{font-size:22px;font-weight:800;color:var(--r);letter-spacing:2.2px;text-transform:uppercase}
.bb-date{font-size:22px;color:var(--m);font-weight:500}
.bb-no{font-size:28px;font-weight:800;color:var(--m);letter-spacing:1px}
.badge{display:inline-block;font-size:var(--fs-label);font-weight:800;letter-spacing:1px;padding:16px 32px;border-radius:999px;text-transform:uppercase;margin-bottom:32px}
.badge.red{background:var(--r);color:#fff}.badge.amb{background:var(--a);color:#000}.badge.grn{background:var(--g);color:#000}
.ctitle{font-size:var(--fs-h1);font-weight:900;color:var(--t);line-height:1.22;margin-bottom:44px;word-break:keep-all;letter-spacing:-0.03em}
.ctitle em{color:var(--r);font-style:normal}.ctitle em.a{color:var(--a)}
.hl{color:#fbbf24;font-style:normal}
.c1{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;padding:72px 88px 132px}
.c1 .g1{position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.25) 0%,transparent 62%);top:-220px;right:-200px}
.c1 .grid,.c6 .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px);background-size:100px 100px}
.c1 .inner,.c6 .inner{position:relative;z-index:1}
.c1 .eyebrow{display:inline-flex;align-items:center;gap:14px;padding:16px 24px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.08);border-radius:999px;color:#fcd34d;font-size:28px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:24px}
.c1 .eyebrow::before{content:'';width:10px;height:10px;border-radius:50%;background:var(--a);box-shadow:0 0 18px rgba(245,158,11,0.8)}
.c1 .hero{font-family:var(--font-display);font-size:var(--fs-hero);font-weight:400;color:#ff5a5a;line-height:0.92;letter-spacing:-3px;margin-bottom:18px;text-shadow:0 0 100px rgba(239,68,68,0.55)}
.c1 .hero2{font-size:112px;font-weight:900;color:var(--t);line-height:1.06;margin-bottom:32px;word-break:keep-all;letter-spacing:-0.04em;max-width:1320px}
.c1 .hero2 em{color:var(--a);font-style:normal}
.c1 .bar{width:168px;height:12px;background:linear-gradient(90deg,var(--r),var(--a));border-radius:6px;margin-bottom:28px}
.c1 .sub{font-size:var(--fs-body);color:var(--m2);line-height:1.64;margin-bottom:32px;font-weight:600;word-break:keep-all;max-width:1280px}
.chips,.ctags{display:flex;gap:16px;flex-wrap:wrap}
.chip{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:var(--m2);font-size:var(--fs-label);font-weight:700;padding:14px 24px;border-radius:99px}
.c2,.c3,.c4,.c5{padding:72px 80px 132px}
.c3,.c4,.c5{padding:64px 76px 132px}
.c2 .ctitle{font-size:108px;line-height:1.04;margin-bottom:28px;max-width:1380px}
.c3 .ctitle,.c4 .ctitle,.c5 .ctitle{font-size:112px;line-height:1.06;margin-bottom:28px;max-width:1380px}
.slist,.ilist,.clist,.alist{display:flex;flex-direction:column;flex:1}
.slist{gap:22px}.ilist{gap:26px}.clist{gap:26px}.alist{gap:24px}
.c2 .slist{gap:18px}
.c3 .ilist,.c4 .clist,.c5 .alist{padding-top:0;padding-bottom:0}
.si,.ii,.ci,.ai{border-radius:16px;border:1px solid var(--bo);background:rgba(255,255,255,0.03)}
.shero{border-radius:24px;border:1px solid rgba(245,158,11,0.22);background:linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03));padding:42px 46px;margin-bottom:22px;min-height:312px;display:flex;flex-direction:column;justify-content:center}
.shero-kicker{font-size:32px;font-weight:800;color:#fbbf24;margin-bottom:18px;letter-spacing:0.5px}
.shero-val{font-size:98px;font-weight:900;color:var(--t);line-height:1.04;letter-spacing:-0.045em;margin-bottom:18px;word-break:keep-all}
.shero-val em{color:var(--a);font-style:normal}
.shero-desc{font-size:48px;color:var(--m2);line-height:1.48;font-weight:600;word-break:keep-all}
.si{padding:32px 36px;display:flex;align-items:center;gap:22px;min-height:196px}
.si.hi{background:rgba(239,68,68,0.07);border-color:rgba(239,68,68,0.25)}
.si-ico{font-size:42px;flex-shrink:0;min-width:52px}
.si-lbl{font-size:34px;font-weight:700;color:var(--m);margin-bottom:10px}
.si-val{font-size:80px;font-weight:900;color:var(--r);line-height:1.06;letter-spacing:-0.04em}
.si-val.a{color:var(--a)}
.si-desc{font-size:38px;color:var(--m2);margin-top:10px;font-weight:600;word-break:keep-all;line-height:1.46}
.ii{padding:30px 34px;display:flex;gap:20px;align-items:flex-start;min-height:188px}
.ii.feature,.ci.feature,.ai.feature{background:rgba(255,255,255,0.06);border-color:rgba(245,158,11,0.18)}
.ii-ico-wrap,.c-n-wrap,.a-ico-wrap{width:96px;min-width:96px;height:96px;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06));display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.06)}
.ii-ico{font-size:48px;line-height:1}
.ii-t{font-size:68px;font-weight:900;color:var(--t);margin-bottom:8px;line-height:1.08;word-break:keep-all;letter-spacing:-0.04em}
.ii-d{font-size:36px;color:var(--m2);line-height:1.4;font-weight:600;word-break:keep-all}
.ci{padding:34px 38px;display:flex;gap:22px;align-items:flex-start;min-height:220px}
.ci.hi{border-color:rgba(239,68,68,0.28);background:rgba(239,68,68,0.05)}
.c-n{width:72px;height:72px;border-radius:20px;background:rgba(245,158,11,0.12);color:#fbbf24;font-size:34px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;letter-spacing:0.04em}
.c-t{font-size:80px;font-weight:900;color:var(--t);margin-bottom:10px;line-height:1.08;word-break:keep-all;letter-spacing:-0.045em}
.c-d{font-size:42px;color:var(--m2);line-height:1.42;font-weight:600;word-break:keep-all}
.ws{background:rgba(245,158,11,0.08);border-left:5px solid var(--a);border-radius:0 12px 12px 0;padding:24px 28px;font-size:30px;color:#fde68a;line-height:1.65;font-weight:500;word-break:keep-all;margin-top:18px}
.ws strong{color:var(--a);font-weight:900}
.ai{padding:34px 38px;display:flex;gap:22px;align-items:flex-start;min-height:212px}
.a-ico{font-size:34px;line-height:1;font-weight:900;color:#fbbf24;letter-spacing:0.04em}
.a-t{font-size:80px;font-weight:900;color:var(--t);margin-bottom:10px;line-height:1.08;word-break:keep-all;letter-spacing:-0.045em}
.a-d{font-size:42px;color:var(--m2);line-height:1.42;font-weight:600;word-break:keep-all}
.gq{background:rgba(34,197,94,0.07);border-left:5px solid var(--g);border-radius:0 12px 12px 0;padding:24px 28px;font-size:30px;color:#86efac;line-height:1.65;margin-top:10px;font-weight:600;word-break:keep-all}
.c6{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;align-items:center;text-align:center;padding:72px 88px 132px}
.c6 .g1{position:absolute;width:650px;height:650px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.18) 0%,transparent 62%);top:-200px;left:50%;transform:translateX(-50%)}
.c6 .inner{display:flex;flex-direction:column;align-items:center}
.c6 .ico{font-size:96px;margin-bottom:28px}
.c6 .ft{font-size:112px;font-weight:900;color:var(--t);line-height:1.12;margin-bottom:24px;word-break:keep-all}
.c6 .ft em{color:var(--r);font-style:normal}
.c6 .fd{font-size:44px;color:var(--m);line-height:1.68;margin-bottom:28px;font-weight:500;word-break:keep-all}
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
    <div class="hero">${highlightText(c1.hero)}</div>
    <div class="hero2">${highlightText(br(c1.hero2 || ''))}</div>
    <div class="bar"></div>
    <div class="sub">${highlightText(br(c1.sub || ''))}</div>
    <div class="chips">${chips(c1.chips)}</div>
  </div>
  ${footer(1)}
</div>

<div class="card c2" id="card-2">
  <div class="badge red">${c2.badge}</div>
  <div class="ctitle">${highlightText(br(c2.title || ''))}</div>
  <div class="shero">
    <div class="shero-kicker">${c2Lead.label || ''}</div>
    <div class="shero-val">${highlightText(c2Lead.title || c2Lead.val || '')}</div>
    <div class="shero-desc">${highlightText(br(c2Lead.desc || ''))}</div>
  </div>
  <div class="slist">${statItems(c2Rest)}</div>
  ${footer(2)}
</div>

<div class="card c3" id="card-3">
  <div class="badge red">${c3.badge}</div>
  <div class="ctitle">${highlightText(br(c3.title || ''))}</div>
  <div class="ilist">${impactItems(c3.items)}</div>
  ${footer(3)}
</div>

<div class="card c4" id="card-4">
  <div class="badge red">${c4.badge}</div>
  <div class="ctitle">${highlightText(br(c4.title || ''))}</div>
  <div class="clist">${causeItems(c4.items)}</div>
  ${warningBlock}
  ${footer(4)}
</div>

<div class="card c5" id="card-5">
  <div class="badge grn">${c5.badge}</div>
  <div class="ctitle">${highlightText(br(c5.title || ''))}</div>
  <div class="alist">${actionItems(c5.items)}</div>
  ${quoteBlock}
  ${footer(5)}
</div>

<div class="card c6" id="card-6">
  <div class="g1"></div><div class="grid"></div>
  <div class="inner">
    <div class="ico">${c6.ico}</div>
    <div class="ft">${highlightText(br(c6.title || ''))}</div>
    <div class="fd">${highlightText(br(c6.desc || ''))}</div>
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

    await page.waitForSelector('#card-6', { timeout: 60000 });

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
