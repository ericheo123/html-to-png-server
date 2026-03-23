const express = require('express');
const { renderCardsWithSvg } = require('./svgRenderer');

const app = express();
app.use(express.json({ limit: '20mb' }));

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

function stripHighlights(value = '') {
  return String(value || '').replace(/\[\[(.+?)\]\]/g, '$1');
}

function parsePayload(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(stripCodeFence(raw));
    } catch (err) {
      const parseError = new Error('Generated JSON is invalid');
      parseError.code = 'INVALID_GENERATED_JSON';
      throw parseError;
    }
  }
  return raw;
}

function iconCandidates(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase();

  if (/자동차|차량|모빌리티/.test(text)) return ['🚗', '🚙', '🛻'];
  if (/반도체|칩|공장|제조/.test(text)) return ['🏭', '⚙️', '🧩'];
  if (/증시|주식|코스피|코스닥|투자/.test(text)) return ['📈', '📊', '💹'];
  if (/환율|달러|원화|외환|무역/.test(text)) return ['💱', '💵', '🌍'];
  if (/수출/.test(text)) return ['📦', '🚢', '🌍'];
  if (/물가|장바구니|소비|수입/.test(text)) return ['🛒', '💳', '📦'];
  if (/기름|유가|전기|에너지/.test(text)) return ['⛽', '⚡', '🔋'];
  if (/여행|항공|직구|해외/.test(text)) return ['✈️', '🧳', '🌐'];
  if (/금리|대출|이자|채권/.test(text)) return ['🏦', '💸', '📉'];
  if (/생산|공급|공급망|재고/.test(text)) return ['🏗️', '📦', '🏭'];
  if (/정부|예산|정책|의회|협상/.test(text)) return ['🏛️', '🧾', '🤝'];
  if (/원인|배경/.test(text)) return ['🔍', '🧩', '📌'];
  if (/확인|체크|점검|주목/.test(text)) return ['✅', '👀', '📝'];

  return ['📌', '📍', '📰'];
}

function inferIcon(...values) {
  return iconCandidates(...values)[0];
}

function sanitizeDisplayIcon(value, ...fallbackContext) {
  const icon = String(value || '').trim();
  if (!icon) {
    return '';
  }

  if (/[A-Za-z0-9가-힣?]/.test(icon) || icon.length > 4) {
    return inferIcon(...fallbackContext);
  }

  return icon;
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

function normalizeText(value = '') {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/([A-Za-z]+)\s*vs\s*([A-Za-z]+)/g, '$1 vs $2')
    .replace(/([A-Za-z])([가-힣])/g, '$1 $2')
    .replace(/([가-힣])([A-Za-z])/g, '$1 $2')
    .replace(/([A-Za-z]{2,})\s+(와|과|은|는|이|가|을|를|도|만|의|로|에|께)/g, '$1$2')
    .replace(/(\d)\s+([가-힣])/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,!.?:;])/g, '$1')
    .trim();
}

function truncateAtBoundary(text, maxLength) {
  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  const sliced = text.slice(0, maxLength).trim();
  const boundary = sliced.search(/[\s,.!?)]?$/);
  const trailingWindow = sliced.slice(Math.max(0, sliced.length - 12));
  const match = trailingWindow.match(/^(.*?)([\s,.!?)](?:[^\s,.!?)]*)?)$/);
  const candidate = match?.[1]?.trim();

  if (candidate && candidate.length >= Math.max(6, Math.floor(maxLength * 0.6))) {
    return candidate;
  }

  return sliced;
}

function limitText(value, maxLength, { preserveHighlights = false } = {}) {
  const text = normalizeText(value);
  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  const truncated = truncateAtBoundary(text, maxLength);
  if (!preserveHighlights) {
    return truncated;
  }

  const openCount = (truncated.match(/\[\[/g) || []).length;
  const closeCount = (truncated.match(/\]\]/g) || []).length;
  if (openCount > closeCount) {
    const repaired = truncated.replace(/\[\[[^[\]]*$/, '').trim();
    if (repaired) {
      return repaired;
    }

    return limitText(stripHighlights(text), maxLength, { preserveHighlights: false });
  }

  return truncated;
}

function sanitizeStringArray(values = [], maxItems, maxLength) {
  return (Array.isArray(values) ? values : [])
    .slice(0, maxItems)
    .map((value) => limitText(value, maxLength))
    .filter(Boolean);
}

function sanitizeNormalized(normalized) {
  return {
    ...normalized,
    topic: limitText(normalized.topic, 32),
    caption: limitText(normalized.caption, 900),
    card1: {
      ...normalized.card1,
      eyebrow: limitText(normalized.card1?.eyebrow, 18),
      hero: limitText(normalized.card1?.hero, 12, { preserveHighlights: true }),
      hero2: limitText(normalized.card1?.hero2, 34, { preserveHighlights: true }),
      sub: limitText(normalized.card1?.sub, 60),
      chips: sanitizeStringArray(normalized.card1?.chips, 4, 16)
    },
    card2: {
      ...normalized.card2,
      badge: limitText(normalized.card2?.badge, 16),
      title: limitText(normalized.card2?.title, 28, { preserveHighlights: true }),
      hero: {
        label: limitText(normalized.card2?.hero?.label, 12),
        title: limitText(normalized.card2?.hero?.title, 28, { preserveHighlights: true }),
        desc: limitText(normalized.card2?.hero?.desc, 74)
      },
      items: (normalized.card2?.items || []).slice(0, 3).map((item) => ({
        ...item,
        label: limitText(item?.label, 12),
        val: limitText(item?.val, 20, { preserveHighlights: true }),
        desc: limitText(item?.desc, 44)
      }))
    },
    card3: {
      ...normalized.card3,
      badge: limitText(normalized.card3?.badge, 16),
      title: limitText(normalized.card3?.title, 28, { preserveHighlights: true }),
      items: (normalized.card3?.items || []).slice(0, 4).map((item) => ({
        ...item,
        label: limitText(item?.label, 12),
        title: limitText(item?.title, 20, { preserveHighlights: true }),
        desc: limitText(item?.desc, 44)
      }))
    },
    card4: {
      ...normalized.card4,
      badge: limitText(normalized.card4?.badge, 16),
      title: limitText(normalized.card4?.title, 30, { preserveHighlights: true }),
      items: (normalized.card4?.items || []).slice(0, 3).map((item) => ({
        ...item,
        title: limitText(item?.title, 20, { preserveHighlights: true }),
        desc: limitText(item?.desc, 48)
      })),
      warning: limitText(normalized.card4?.warning, 56)
    },
    card5: {
      ...normalized.card5,
      badge: limitText(normalized.card5?.badge, 16),
      title: limitText(normalized.card5?.title, 30, { preserveHighlights: true }),
      items: (normalized.card5?.items || []).slice(0, 4).map((item) => ({
        ...item,
        title: limitText(item?.title, 18, { preserveHighlights: true }),
        desc: limitText(item?.desc, 42)
      })),
      quote: limitText(normalized.card5?.quote, 42)
    },
    card6: {
      ...normalized.card6,
      title: limitText(normalized.card6?.title, 40, { preserveHighlights: true }),
      desc: limitText(normalized.card6?.desc, 140),
      tags: sanitizeStringArray(normalized.card6?.tags, 4, 16)
    }
  };
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
  const icons = pickUniqueIcons(rows, () => '📌', ['📌', '📈', '💡', '🧭']);

  return rows.map((item, index) => ({
    ico: icons[index] || '',
    label: item.label || '',
    val: item.value || item.val || item.label || '',
    desc: item.desc || '',
    amber: index === 2,
    highlight: index < 2
  }));
}

function mapImpactItems(items = []) {
  const rows = items.slice(0, 4);
  const icons = pickUniqueIcons(rows, () => '🛒', ['🛒', '💸', '💱', '📦', '📉', '🌍']);

  return rows.map((item, index) => ({
    ico: icons[index] || inferIcon(item.label, item.value, item.desc),
    label: item.label || '',
    title: item.value || item.label || '',
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
  const icons = pickUniqueIcons(rows, () => '✅', ['✅', '👀', '📝', '📊', '🛒']);

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
      '오늘 이슈';
    const fallbackSub =
      cover.headline_sub ||
      cover.summary ||
      parsed.topic ||
      '지금 흐름을 짧게 정리했어요';

    return sanitizeNormalized({
      date: parsed.date,
      topic: parsed.topic || '',
      caption: parsed.caption || '',
      card1: {
        eyebrow: cover.eyebrow || parsed.topic || '',
        hero: fallbackMain,
        hero2: fallbackSub === fallbackMain ? (cover.summary || '지금 흐름을 짧게 정리했어요') : fallbackSub,
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
        ico: sanitizeDisplayIcon(closing.ico, closing.title, closing.summary, closing.cta),
        title: closing.title || '',
        desc: [closing.summary, closing.cta].filter(Boolean).join('\n\n'),
        tags: closing.hashtags || []
      }
    });
  }

  throw new Error('Invalid cards structure');
}

async function renderCards(normalized) {
  console.log('[generate] rendering with svg');
  return renderCardsWithSvg(normalized);
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
    const { images, debugHtml } = await renderCards(normalized);

    const effectiveImgBBKey = imgbbKey || process.env.IMGBB_API_KEY;
    let uploads = [];
    let urls = [];
    let instagram = null;

    if (effectiveImgBBKey) {
      console.log('[generate] uploading images to imgBB');
      uploads = await Promise.all(
        images.map((image, index) =>
          uploadToImgBB(image, effectiveImgBBKey, `card-${index + 1}-${Date.now()}.png`)
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
      response.html = debugHtml || null;
      response.normalized = normalized;
    } else {
      response.urls = urls;
      response.uploads = uploads;
    }

    res.json(response);
  } catch (err) {
    console.error('[generate] error:', err);
    const statusCode = err.code === 'INVALID_GENERATED_JSON' ? 400 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`server listening on port ${PORT}`));

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[server] received ${signal}, shutting down gracefully`);

  server.close((err) => {
    if (err) {
      console.error('[server] graceful shutdown failed:', err);
      process.exit(1);
      return;
    }

    console.log('[server] shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[server] shutdown timeout reached, forcing exit');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

