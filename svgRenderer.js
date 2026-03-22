const sharp = require('sharp');

const WIDTH = 1080;
const HEIGHT = 1350;
const FOOTER_HEIGHT = 96;
const SIDE = 58;
const YELLOW = '#fbbf24';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.76)';
const MUTED_SOFT = 'rgba(255,255,255,0.56)';
const CARD_BG = '#172132';
const CARD_ALT = '#241f2a';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const RED = '#ef5350';
const GREEN = '#32c96a';

function esc(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tokenizeHighlights(value = '') {
  const text = String(value || '');
  const tokens = [];
  const pattern = /\[\[(.+?)\]\]/g;
  let cursor = 0;
  let match;
  let highlightCount = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      tokens.push({ text: text.slice(cursor, match.index), highlight: false });
    }

    const inner = match[1];
    if (inner.length <= 12 && highlightCount < 2) {
      tokens.push({ text: inner, highlight: true });
      highlightCount += 1;
    } else {
      tokens.push({ text: inner, highlight: false });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    tokens.push({ text: text.slice(cursor), highlight: false });
  }

  return tokens.filter((token) => token.text);
}

function wrapTokens(tokens, maxCharsPerLine, maxLines) {
  const lines = [];
  let current = [];
  let currentLen = 0;

  const pushCurrent = () => {
    if (current.length) {
      lines.push(current);
      current = [];
      currentLen = 0;
    }
  };

  for (const token of tokens) {
    const parts = token.text.split(/(\s+)/).filter(Boolean);
    for (const part of parts) {
      const len = part.replace(/\s+/g, ' ').length;
      if (!current.length) {
        current.push({ ...token, text: part });
        currentLen = len;
        continue;
      }

      if (currentLen + len > maxCharsPerLine) {
        pushCurrent();
        if (lines.length >= maxLines) break;
      }

      if (lines.length >= maxLines) break;
      current.push({ ...token, text: part });
      currentLen += len;
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines) {
    pushCurrent();
  }

  return lines.slice(0, maxLines);
}

function textBlock({
  x,
  y,
  text,
  width,
  fontSize,
  lineHeight,
  fill = WHITE,
  weight = 700,
  anchor = 'start',
  maxLines = 2
}) {
  const avgCharWidth = fontSize * 0.58;
  const maxCharsPerLine = Math.max(6, Math.floor(width / avgCharWidth));
  const lines = wrapTokens(tokenizeHighlights(text), maxCharsPerLine, maxLines);
  const textAnchor = anchor === 'middle' ? 'middle' : 'start';
  const baseX = anchor === 'middle' ? x + width / 2 : x;

  const tspanLines = lines
    .map((line, index) => {
      const yPos = y + index * lineHeight;
      const segments = line
        .map((segment) => {
          const color = segment.highlight ? YELLOW : fill;
          return `<tspan fill="${color}">${esc(segment.text)}</tspan>`;
        })
        .join('');
      return `<tspan x="${baseX}" y="${yPos}">${segments}</tspan>`;
    })
    .join('');

  return `<text x="${baseX}" y="${y}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','Segoe UI Emoji',sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${textAnchor}" dominant-baseline="hanging">${tspanLines}</text>`;
}

function plainLines(text = '', width, fontSize, maxLines = 2) {
  const avgCharWidth = fontSize * 0.56;
  const maxCharsPerLine = Math.max(8, Math.floor(width / avgCharWidth));
  return wrapTokens([{ text: String(text || ''), highlight: false }], maxCharsPerLine, maxLines)
    .map((line) => line.map((seg) => seg.text).join(''))
    .join('\n');
}

function multilinePlainText({
  x,
  y,
  text,
  width,
  fontSize,
  lineHeight,
  fill = MUTED,
  weight = 600,
  anchor = 'start',
  maxLines = 3
}) {
  return textBlock({ x, y, text, width, fontSize, lineHeight, fill, weight, anchor, maxLines });
}

function roundedRect({ x, y, width, height, fill, stroke = CARD_BORDER, radius = 18 }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}" stroke="${stroke}" />`;
}

function footer(pageNo, date) {
  return `
    <rect x="0" y="${HEIGHT - FOOTER_HEIGHT}" width="${WIDTH}" height="${FOOTER_HEIGHT}" fill="rgba(0,0,0,0.58)" />
    <text x="${SIDE}" y="${HEIGHT - 40}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="18" font-weight="800" fill="${RED}" letter-spacing="1.6">TODAY BRIEF</text>
    <text x="${WIDTH / 2}" y="${HEIGHT - 38}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="22" font-weight="800" fill="rgba(255,255,255,0.66)" text-anchor="middle">${String(pageNo).padStart(2, '0')} / 06</text>
    <text x="${WIDTH - SIDE}" y="${HEIGHT - 38}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.5)" text-anchor="end">${esc(date)}</text>
  `;
}

function background(red = true) {
  return `
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${red ? '#230100' : '#111827'}" />
        <stop offset="62%" stop-color="${red ? '#3a0903' : '#0f172a'}" />
        <stop offset="100%" stop-color="#080c14" />
      </linearGradient>
      <radialGradient id="glow" cx="82%" cy="12%" r="48%">
        <stop offset="0%" stop-color="${red ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.16)'}" />
        <stop offset="100%" stop-color="rgba(0,0,0,0)" />
      </radialGradient>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="${red ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.05)'}" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGrad)" />
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" />
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" />
  `;
}

function badge(label, color) {
  return `
    <rect x="${SIDE}" y="46" width="${WIDTH - SIDE * 2}" height="44" rx="22" fill="${color}" />
    <text x="${SIDE + 18}" y="75" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="18" font-weight="800" fill="${color === YELLOW ? '#111827' : '#ffffff'}">${esc(label || '')}</text>
  `;
}

function renderCover(card, date) {
  return `
    ${background(true)}
    ${textBlock({ x: SIDE, y: 126, text: card.eyebrow || '', width: 360, fontSize: 20, lineHeight: 24, fill: '#fcd34d', weight: 800, maxLines: 1 })}
    ${textBlock({ x: SIDE, y: 200, text: card.hero || '', width: 520, fontSize: 128, lineHeight: 116, fill: YELLOW, weight: 900, maxLines: 2 })}
    ${textBlock({ x: SIDE, y: 500, text: card.hero2 || '', width: WIDTH - SIDE * 2, fontSize: 74, lineHeight: 80, fill: WHITE, weight: 900, maxLines: 3 })}
    <rect x="${SIDE}" y="756" width="104" height="8" rx="4" fill="${YELLOW}" />
    ${multilinePlainText({ x: SIDE, y: 794, text: card.sub || '', width: WIDTH - SIDE * 2, fontSize: 26, lineHeight: 42, fill: MUTED, weight: 600, maxLines: 3 })}
    ${renderChips(card.chips || [], HEIGHT - 210)}
    ${footer(1, date)}
  `;
}

function renderChips(chips, y) {
  let x = SIDE;
  const blocks = [];
  for (const chip of chips.slice(0, 4)) {
    const width = Math.max(90, chip.length * 16 + 30);
    blocks.push(`<rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.1)" />`);
    blocks.push(`<text x="${x + 16}" y="${y + 25}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="18" font-weight="700" fill="rgba(255,255,255,0.72)">${esc(chip)}</text>`);
    x += width + 12;
  }
  return blocks.join('');
}

function renderStats(card, date) {
  const hero = card.hero || {};
  const items = card.items || [];
  return `
    ${background(false)}
    ${badge(card.badge || '', RED)}
    ${textBlock({ x: SIDE, y: 128, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 72, lineHeight: 76, fill: WHITE, weight: 900, maxLines: 3 })}
    ${roundedRect({ x: SIDE, y: 308, width: WIDTH - SIDE * 2, height: 230, fill: '#22242c', stroke: 'rgba(245,158,11,0.18)', radius: 24 })}
    ${textBlock({ x: SIDE + 26, y: 338, text: hero.label || '', width: WIDTH - SIDE * 2 - 52, fontSize: 22, lineHeight: 26, fill: YELLOW, weight: 800, maxLines: 1 })}
    ${textBlock({ x: SIDE + 26, y: 382, text: hero.title || '', width: WIDTH - SIDE * 2 - 52, fontSize: 56, lineHeight: 60, fill: WHITE, weight: 900, maxLines: 2 })}
    ${multilinePlainText({ x: SIDE + 26, y: 478, text: hero.desc || '', width: WIDTH - SIDE * 2 - 52, fontSize: 25, lineHeight: 34, fill: MUTED, weight: 600, maxLines: 2 })}
    ${renderSupportCards(items)}
    ${footer(2, date)}
  `;
}

function renderSupportCards(items) {
  const startY = 574;
  const gap = 18;
  const height = 170;
  return items.slice(0, 3).map((item, index) => {
    const y = startY + index * (height + gap);
    const title = item.val || item.label || '';
    const eyebrow = item.label && item.label !== title ? item.label : '';
    return `
      ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height, fill: index === 0 ? CARD_ALT : CARD_BG, radius: 22 })}
      <text x="${SIDE + 28}" y="${y + 54}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','Segoe UI Emoji',sans-serif" font-size="34">${esc(item.ico || '📌')}</text>
      ${eyebrow ? textBlock({ x: SIDE + 82, y: y + 18, text: eyebrow, width: WIDTH - SIDE * 2 - 110, fontSize: 18, lineHeight: 22, fill: MUTED_SOFT, weight: 800, maxLines: 1 }) : ''}
      ${textBlock({ x: SIDE + 82, y: y + (eyebrow ? 42 : 24), text: title, width: WIDTH - SIDE * 2 - 110, fontSize: 44, lineHeight: 48, fill: index === 2 ? YELLOW : WHITE, weight: 900, maxLines: 2 })}
      ${multilinePlainText({ x: SIDE + 82, y: y + (eyebrow ? 108 : 98), text: item.desc || '', width: WIDTH - SIDE * 2 - 110, fontSize: 24, lineHeight: 32, fill: MUTED, weight: 600, maxLines: 2 })}
    `;
  }).join('');
}

function renderImpact(card, date) {
  const items = card.items || [];
  return `
    ${background(false)}
    ${badge(card.badge || '', RED)}
    ${textBlock({ x: SIDE, y: 126, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 72, lineHeight: 78, fill: WHITE, weight: 900, maxLines: 3 })}
    ${items.slice(0, 4).map((item, index) => {
      const y = 300 + index * 190;
      return `
        ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height: 164, fill: CARD_BG, radius: 22 })}
        <rect x="${SIDE + 22}" y="${y + 34}" width="66" height="66" rx="18" fill="rgba(255,255,255,0.08)" />
        <text x="${SIDE + 55}" y="${y + 79}" text-anchor="middle" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','Segoe UI Emoji',sans-serif" font-size="34">${esc(item.ico || '📌')}</text>
        ${item.label && item.label !== item.title ? textBlock({ x: SIDE + 106, y: y + 18, text: item.label, width: WIDTH - SIDE * 2 - 136, fontSize: 18, lineHeight: 22, fill: MUTED_SOFT, weight: 800, maxLines: 1 }) : ''}
        ${textBlock({ x: SIDE + 106, y: y + (item.label && item.label !== item.title ? 42 : 26), text: item.title || '', width: WIDTH - SIDE * 2 - 136, fontSize: 38, lineHeight: 42, fill: WHITE, weight: 900, maxLines: 2 })}
        ${multilinePlainText({ x: SIDE + 106, y: y + (item.label && item.label !== item.title ? 96 : 92), text: item.desc || '', width: WIDTH - SIDE * 2 - 136, fontSize: 23, lineHeight: 30, fill: MUTED, weight: 600, maxLines: 2 })}
      `;
    }).join('')}
    ${footer(3, date)}
  `;
}

function renderCauses(card, date) {
  const items = card.items || [];
  return `
    ${background(false)}
    ${badge(card.badge || '', RED)}
    ${textBlock({ x: SIDE, y: 126, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 70, lineHeight: 76, fill: WHITE, weight: 900, maxLines: 3 })}
    ${items.slice(0, 3).map((item, index) => {
      const y = 310 + index * 198;
      return `
        ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height: 172, fill: index === 2 ? CARD_BG : CARD_ALT, radius: 22 })}
        <circle cx="${SIDE + 44}" cy="${y + 54}" r="26" fill="rgba(251,191,36,0.16)" />
        <text x="${SIDE + 44}" y="${y + 63}" text-anchor="middle" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="28" font-weight="900" fill="${YELLOW}">${index + 1}</text>
        ${textBlock({ x: SIDE + 88, y: y + 24, text: item.title || '', width: WIDTH - SIDE * 2 - 116, fontSize: 52, lineHeight: 56, fill: WHITE, weight: 900, maxLines: 2 })}
        ${multilinePlainText({ x: SIDE + 88, y: y + 96, text: item.desc || '', width: WIDTH - SIDE * 2 - 116, fontSize: 24, lineHeight: 32, fill: MUTED, weight: 600, maxLines: 2 })}
      `;
    }).join('')}
    ${card.warning ? `
      <rect x="${SIDE}" y="955" width="${WIDTH - SIDE * 2}" height="82" rx="14" fill="rgba(251,191,36,0.08)" />
      <rect x="${SIDE}" y="955" width="5" height="82" rx="2.5" fill="${YELLOW}" />
      ${textBlock({ x: SIDE + 22, y: 980, text: card.warning, width: WIDTH - SIDE * 2 - 44, fontSize: 22, lineHeight: 28, fill: '#fde68a', weight: 700, maxLines: 2 })}
    ` : ''}
    ${footer(4, date)}
  `;
}

function renderAction(card, date) {
  const items = card.items || [];
  return `
    ${background(false)}
    ${badge(card.badge || '', GREEN)}
    ${textBlock({ x: SIDE, y: 126, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 70, lineHeight: 76, fill: WHITE, weight: 900, maxLines: 3 })}
    ${items.slice(0, 4).map((item, index) => {
      const y = 310 + index * 178;
      return `
        ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height: 154, fill: CARD_BG, radius: 22 })}
        <rect x="${SIDE + 22}" y="${y + 34}" width="66" height="66" rx="18" fill="rgba(255,255,255,0.08)" />
        <text x="${SIDE + 55}" y="${y + 79}" text-anchor="middle" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','Segoe UI Emoji',sans-serif" font-size="32">${esc(item.ico || '✅')}</text>
        ${textBlock({ x: SIDE + 104, y: y + 24, text: item.title || '', width: WIDTH - SIDE * 2 - 132, fontSize: 38, lineHeight: 42, fill: WHITE, weight: 900, maxLines: 2 })}
        ${multilinePlainText({ x: SIDE + 104, y: y + 90, text: item.desc || '', width: WIDTH - SIDE * 2 - 132, fontSize: 22, lineHeight: 30, fill: MUTED, weight: 600, maxLines: 2 })}
      `;
    }).join('')}
    ${card.quote ? `
      <rect x="${SIDE}" y="1030" width="${WIDTH - SIDE * 2}" height="88" rx="14" fill="rgba(34,197,94,0.08)" />
      <rect x="${SIDE}" y="1030" width="5" height="88" rx="2.5" fill="${GREEN}" />
      ${textBlock({ x: SIDE + 20, y: 1058, text: card.quote, width: WIDTH - SIDE * 2 - 40, fontSize: 24, lineHeight: 30, fill: '#86efac', weight: 700, maxLines: 2 })}
    ` : ''}
    ${footer(5, date)}
  `;
}

function renderClosing(card, date) {
  const [summary, cta] = String(card.desc || '').split('\n\n');
  return `
    ${background(true)}
    <text x="${WIDTH / 2}" y="240" text-anchor="middle" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','Segoe UI Emoji',sans-serif" font-size="82">${esc(card.ico || '📌')}</text>
    ${textBlock({ x: SIDE, y: 320, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 74, lineHeight: 82, fill: WHITE, weight: 900, anchor: 'middle', maxLines: 3 })}
    ${multilinePlainText({ x: SIDE, y: 556, text: summary || '', width: WIDTH - SIDE * 2, fontSize: 28, lineHeight: 42, fill: MUTED, weight: 600, anchor: 'middle', maxLines: 3 })}
    ${textBlock({ x: SIDE, y: 744, text: cta || '', width: WIDTH - SIDE * 2, fontSize: 34, lineHeight: 40, fill: WHITE, weight: 800, anchor: 'middle', maxLines: 2 })}
    ${renderChips(card.tags || [], 860)}
    ${footer(6, date)}
  `;
}

function buildSvg(cardNo, normalized, date) {
  const card = normalized[`card${cardNo}`] || {};
  let body = '';

  switch (cardNo) {
    case 1:
      body = renderCover(card, date);
      break;
    case 2:
      body = renderStats(card, date);
      break;
    case 3:
      body = renderImpact(card, date);
      break;
    case 4:
      body = renderCauses(card, date);
      break;
    case 5:
      body = renderAction(card, date);
      break;
    case 6:
      body = renderClosing(card, date);
      break;
    default:
      body = background(false);
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      ${body}
    </svg>
  `;
}

async function renderCardsWithSvg(normalized) {
  const date = normalized.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const buffers = [];

  for (let i = 1; i <= 6; i += 1) {
    const svg = buildSvg(i, normalized, date);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    buffers.push(png.toString('base64'));
  }

  return { images: buffers, debugHtml: null };
}

module.exports = {
  renderCardsWithSvg
};
