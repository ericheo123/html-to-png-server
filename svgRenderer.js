const fs = require('fs');
const path = require('path');
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
const PAPERLOGY_PATH = path.join(__dirname, 'fonts', 'Paperlogy-6SemiBold.ttf');
const PAPERLOGY_FONT = fs.existsSync(PAPERLOGY_PATH)
  ? fs.readFileSync(PAPERLOGY_PATH).toString('base64')
  : '';
const UI_FONT = PAPERLOGY_FONT
  ? "'Paperlogy','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
  : "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const DISPLAY_FONT = PAPERLOGY_FONT
  ? "'Paperlogy','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
  : UI_FONT;

function sanitizeText(value = '') {
  return String(value || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitizeFragment(value = '') {
  return String(value || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/gu, '')
    .replace(/\t+/g, ' ');
}

function sanitizeIcon(value = '', fallback = '◆') {
  const cleaned = sanitizeText(value);
  return cleaned || fallback;
}

function esc(value = '') {
  return sanitizeFragment(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function svgText(value = '') {
  return esc(value);
}

function tokenizeHighlights(value = '') {
  const text = sanitizeText(value);
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
    const rawParts = token.text.split(/(\n|\s+)/).filter(Boolean);
    const parts = rawParts.flatMap((part) => {
      if (part === '\n') {
        return ['\n'];
      }

      if (/^\s+$/.test(part) || part.length <= maxCharsPerLine) {
        return [part];
      }

      // Korean headlines often arrive without spaces, so split long runs safely.
      return Array.from(part);
    });

    for (const part of parts) {
      if (part === '\n') {
        pushCurrent();
        if (lines.length >= maxLines) break;
        continue;
      }

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

function charVisualWidth(char, fontSize) {
  if (char === ' ') return fontSize * 0.42;
  if (/[A-Z0-9]/.test(char)) return fontSize * 0.76;
  if (/[a-z]/.test(char)) return fontSize * 0.62;
  if (/[.,!?;:()\-]/.test(char)) return fontSize * 0.36;
  return fontSize * 1.04;
}

function estimateLineWidth(text, fontSize, letterSpacing = 0) {
  const chars = Array.from(String(text || ''));
  const glyphWidth = chars.reduce((sum, char) => sum + charVisualWidth(char, fontSize), 0);
  const spacingWidth = Math.max(0, chars.length - 1) * letterSpacing;
  return glyphWidth + spacingWidth;
}

function lineText(line = []) {
  return line.map((segment) => segment.text).join('');
}

function fitTypography(text, width, fontSize, lineHeight, maxLines, minFontSize = 22, letterSpacing = 0) {
  let size = fontSize;
  let height = lineHeight;
  const content = sanitizeText(text);

  while (size > minFontSize) {
    const avgCharWidth = size * 0.72;
    const maxCharsPerLine = Math.max(6, Math.floor(width / avgCharWidth));
    const lines = wrapTokens(tokenizeHighlights(content), maxCharsPerLine, maxLines);
    const joinedLength = lines.map((line) => lineText(line)).join('').length;
    const widestLine = Math.max(...lines.map((line) => estimateLineWidth(lineText(line), size, letterSpacing)), 0);

    if ((lines.length < maxLines || joinedLength >= content.replace(/\s+/g, '').length) && widestLine <= width) {
      return { fontSize: size, lineHeight: height };
    }

    size -= 4;
    height = Math.max(Math.round(size * 1.1), size + 4);
  }

  return { fontSize: size, lineHeight: height };
}

function fittedTextBlock(options) {
  const fitted = fitTypography(
    options.text,
    options.width,
    options.fontSize,
    options.lineHeight,
    options.maxLines || 2,
    options.minFontSize || 22,
    options.letterSpacing || 0
  );

  return textBlock({
    ...options,
    fontSize: fitted.fontSize,
    lineHeight: fitted.lineHeight
  });
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
  maxLines = 2,
  fontFamily = UI_FONT,
  letterSpacing = 0,
  wordSpacing = 2,
  extraAttrs = ''
}) {
  const avgCharWidth = fontSize * 0.72;
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
          return `<tspan fill="${color}" xml:space="preserve">${svgText(segment.text)}</tspan>`;
        })
        .join('');
      return `<tspan x="${baseX}" y="${yPos}">${segments}</tspan>`;
    })
    .join('');

  return `<text x="${baseX}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${textAnchor}" dominant-baseline="hanging" xml:space="preserve" letter-spacing="${letterSpacing}" word-spacing="${wordSpacing}" ${extraAttrs}>${tspanLines}</text>`;
}

function plainLines(text = '', width, fontSize, maxLines = 2) {
  const avgCharWidth = fontSize * 0.56;
  const maxCharsPerLine = Math.max(8, Math.floor(width / avgCharWidth));
  return wrapTokens([{ text: sanitizeText(text), highlight: false }], maxCharsPerLine, maxLines)
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

function coverHeadline(text = '') {
  const value = String(text || '').trim();
  if (!value || value.includes('\n')) {
    return value;
  }

  if (value.includes(',')) {
    return value.replace(/,\s*/u, ',\n');
  }

  return value;
}

function roundedRect({ x, y, width, height, fill, stroke = CARD_BORDER, radius = 18 }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}" stroke="${stroke}" />`;
}

function lineChartIcon({ x, y, size = 84, color = YELLOW }) {
  const s = size;
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${s}" height="${s}" rx="${Math.round(s * 0.28)}" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
      <path d="M ${s * 0.2} ${s * 0.72} L ${s * 0.42} ${s * 0.52} L ${s * 0.56} ${s * 0.6} L ${s * 0.78} ${s * 0.34}" fill="none" stroke="${color}" stroke-width="${Math.max(4, s * 0.07)}" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${s * 0.2}" cy="${s * 0.72}" r="${Math.max(3, s * 0.05)}" fill="${color}" />
      <circle cx="${s * 0.42}" cy="${s * 0.52}" r="${Math.max(3, s * 0.05)}" fill="${color}" />
      <circle cx="${s * 0.56}" cy="${s * 0.6}" r="${Math.max(3, s * 0.05)}" fill="${color}" />
      <circle cx="${s * 0.78}" cy="${s * 0.34}" r="${Math.max(3, s * 0.05)}" fill="${color}" />
    </g>
  `;
}

function iconKey(token = '') {
  const value = String(token || '');
  if (/📈|📊|💹/.test(value)) return 'trend';
  if (/💱|💵/.test(value)) return 'currency';
  if (/🌍|🌐/.test(value)) return 'globe';
  if (/📦|🛒/.test(value)) return 'box';
  if (/✅|👀|📝/.test(value)) return 'check';
  if (/💡|🧭|📌|📍|🔍/.test(value)) return 'spark';
  return 'diamond';
}

function renderPathIcon({ x, y, size = 28, color = WHITE, token = '' }) {
  const key = iconKey(token);
  const s = size;
  const stroke = Math.max(2, s * 0.1);
  const left = x - s / 2;
  const top = y - s / 2;

  if (key === 'trend') {
    return `
      <g transform="translate(${left}, ${top})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M ${s * 0.18} ${s * 0.72} L ${s * 0.4} ${s * 0.5} L ${s * 0.58} ${s * 0.58} L ${s * 0.82} ${s * 0.3}" />
        <path d="M ${s * 0.68} ${s * 0.3} H ${s * 0.82} V ${s * 0.44}" />
      </g>
    `;
  }

  if (key === 'currency') {
    return `
      <g transform="translate(${left}, ${top})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M ${s * 0.5} ${s * 0.16} V ${s * 0.84}" />
        <path d="M ${s * 0.7} ${s * 0.26} C ${s * 0.62} ${s * 0.18}, ${s * 0.36} ${s * 0.18}, ${s * 0.32} ${s * 0.34} C ${s * 0.28} ${s * 0.5}, ${s * 0.72} ${s * 0.48}, ${s * 0.68} ${s * 0.66} C ${s * 0.64} ${s * 0.82}, ${s * 0.4} ${s * 0.82}, ${s * 0.3} ${s * 0.72}" />
      </g>
    `;
  }

  if (key === 'globe') {
    return `
      <g transform="translate(${left}, ${top})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="${s * 0.5}" cy="${s * 0.5}" r="${s * 0.34}" />
        <path d="M ${s * 0.16} ${s * 0.5} H ${s * 0.84}" />
        <path d="M ${s * 0.5} ${s * 0.16} C ${s * 0.38} ${s * 0.26}, ${s * 0.38} ${s * 0.74}, ${s * 0.5} ${s * 0.84}" />
        <path d="M ${s * 0.5} ${s * 0.16} C ${s * 0.62} ${s * 0.26}, ${s * 0.62} ${s * 0.74}, ${s * 0.5} ${s * 0.84}" />
      </g>
    `;
  }

  if (key === 'box') {
    return `
      <g transform="translate(${left}, ${top})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="${s * 0.2}" y="${s * 0.24}" width="${s * 0.6}" height="${s * 0.52}" rx="${s * 0.08}" />
        <path d="M ${s * 0.2} ${s * 0.38} H ${s * 0.8}" />
        <path d="M ${s * 0.5} ${s * 0.38} V ${s * 0.76}" />
      </g>
    `;
  }

  if (key === 'check') {
    return `
      <g transform="translate(${left}, ${top})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M ${s * 0.24} ${s * 0.54} L ${s * 0.42} ${s * 0.72} L ${s * 0.76} ${s * 0.32}" />
      </g>
    `;
  }

  if (key === 'spark') {
    return `
      <g transform="translate(${left}, ${top})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M ${s * 0.5} ${s * 0.16} L ${s * 0.58} ${s * 0.42} L ${s * 0.84} ${s * 0.5} L ${s * 0.58} ${s * 0.58} L ${s * 0.5} ${s * 0.84} L ${s * 0.42} ${s * 0.58} L ${s * 0.16} ${s * 0.5} L ${s * 0.42} ${s * 0.42} Z" />
      </g>
    `;
  }

  return `
    <g transform="translate(${left}, ${top})" fill="${color}">
      <path d="M ${s * 0.5} ${s * 0.16} L ${s * 0.84} ${s * 0.5} L ${s * 0.5} ${s * 0.84} L ${s * 0.16} ${s * 0.5} Z" />
    </g>
  `;
}

function footer(pageNo, date) {
  return `
    <rect x="0" y="${HEIGHT - FOOTER_HEIGHT}" width="${WIDTH}" height="${FOOTER_HEIGHT}" fill="rgba(0,0,0,0.58)" />
    <text x="${SIDE}" y="${HEIGHT - 40}" font-family="${UI_FONT}" font-size="18" font-weight="800" fill="${RED}" letter-spacing="1.6">TODAY BRIEF</text>
    <text x="${WIDTH / 2}" y="${HEIGHT - 38}" font-family="${UI_FONT}" font-size="22" font-weight="800" fill="rgba(255,255,255,0.66)" text-anchor="middle">${String(pageNo).padStart(2, '0')} / 06</text>
    <text x="${WIDTH - SIDE}" y="${HEIGHT - 38}" font-family="${UI_FONT}" font-size="18" font-weight="600" fill="rgba(255,255,255,0.5)" text-anchor="end">${esc(date)}</text>
  `;
}

function background(red = true) {
  return `
    <defs>
      ${PAPERLOGY_FONT ? `
      <style>
        @font-face {
          font-family: 'Paperlogy';
          src: url("data:font/ttf;base64,${PAPERLOGY_FONT}") format('truetype');
          font-weight: 600 900;
          font-style: normal;
        }
      </style>` : ''}
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
    <text x="${SIDE + 18}" y="75" font-family="${UI_FONT}" font-size="18" font-weight="800" fill="${color === YELLOW ? '#111827' : '#ffffff'}">${esc(label || '')}</text>
  `;
}

function renderCover(card, date) {
  const eyebrow = plainLines(card.eyebrow || '', 340, 20, 1);
  const eyebrowWidth = Math.max(170, Math.min(340, eyebrow.length * 18 + 54));
  const displayFont = DISPLAY_FONT;
  const leadHeadline = coverHeadline(card.hero2 || '');

  return `
    ${background(true)}
    <defs>
      <radialGradient id="coverHeroGlow" cx="23%" cy="26%" r="26%">
        <stop offset="0%" stop-color="rgba(251,191,36,0.22)" />
        <stop offset="100%" stop-color="rgba(251,191,36,0)" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#coverHeroGlow)" />
    <rect x="${SIDE}" y="104" width="${eyebrowWidth}" height="56" rx="28" fill="rgba(255,184,0,0.08)" stroke="rgba(255,184,0,0.24)" />
    <circle cx="${SIDE + 24}" cy="132" r="6" fill="#f59e0b" />
    ${textBlock({ x: SIDE + 42, y: 116, text: card.eyebrow || '', width: eyebrowWidth - 60, fontSize: 21, lineHeight: 24, fill: '#fcd34d', weight: 800, maxLines: 1 })}
    ${fittedTextBlock({ x: SIDE + 6, y: 214, text: card.hero || '', width: 640, fontSize: 154, lineHeight: 124, fill: 'rgba(0,0,0,0.24)', weight: 940, maxLines: 2, minFontSize: 108, fontFamily: displayFont, letterSpacing: -1.4 })}
    ${fittedTextBlock({ x: SIDE, y: 206, text: card.hero || '', width: 640, fontSize: 154, lineHeight: 124, fill: YELLOW, weight: 940, maxLines: 2, minFontSize: 108, fontFamily: displayFont, letterSpacing: -1.4 })}
    ${fittedTextBlock({ x: SIDE + 6, y: 438, text: leadHeadline, width: WIDTH - 156, fontSize: 88, lineHeight: 88, fill: 'rgba(0,0,0,0.28)', weight: 960, maxLines: 3, minFontSize: 60, fontFamily: displayFont, letterSpacing: -0.4 })}
    ${fittedTextBlock({ x: SIDE, y: 430, text: leadHeadline, width: WIDTH - 156, fontSize: 88, lineHeight: 88, fill: WHITE, weight: 960, maxLines: 3, minFontSize: 60, fontFamily: displayFont, letterSpacing: -0.4 })}
    <defs>
      <linearGradient id="coverAccent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ff5f57" />
        <stop offset="100%" stop-color="#f59e0b" />
      </linearGradient>
    </defs>
    <rect x="${SIDE}" y="728" width="126" height="10" rx="5" fill="url(#coverAccent)" />
    ${multilinePlainText({ x: SIDE, y: 770, text: card.sub || '', width: WIDTH - 160, fontSize: 28, lineHeight: 44, fill: MUTED, weight: 650, maxLines: 3 })}
    ${renderChips(card.chips || [], HEIGHT - 208)}
    ${footer(1, date)}
  `;
}

function renderChips(chips, y) {
  let x = SIDE;
  const blocks = [];
  for (const chip of chips.slice(0, 4)) {
    const width = Math.max(90, chip.length * 16 + 30);
    blocks.push(`<rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.1)" />`);
    blocks.push(`<text x="${x + 16}" y="${y + 25}" font-family="${UI_FONT}" font-size="18" font-weight="700" fill="rgba(255,255,255,0.72)">${esc(chip)}</text>`);
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
    ${fittedTextBlock({ x: SIDE, y: 122, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 68, lineHeight: 74, fill: WHITE, weight: 920, maxLines: 3, minFontSize: 46, fontFamily: DISPLAY_FONT })}
    ${roundedRect({ x: SIDE, y: 300, width: WIDTH - SIDE * 2, height: 252, fill: '#22242c', stroke: 'rgba(245,158,11,0.16)', radius: 26 })}
    ${textBlock({ x: SIDE + 28, y: 332, text: hero.label || '', width: WIDTH - SIDE * 2 - 56, fontSize: 22, lineHeight: 26, fill: YELLOW, weight: 800, maxLines: 1 })}
    ${fittedTextBlock({ x: SIDE + 28, y: 376, text: hero.title || '', width: WIDTH - SIDE * 2 - 56, fontSize: 54, lineHeight: 58, fill: WHITE, weight: 920, maxLines: 2, minFontSize: 36, fontFamily: DISPLAY_FONT })}
    ${multilinePlainText({ x: SIDE + 28, y: 470, text: hero.desc || '', width: WIDTH - SIDE * 2 - 56, fontSize: 24, lineHeight: 34, fill: MUTED, weight: 620, maxLines: 2 })}
    ${renderSupportCards(items)}
    ${footer(2, date)}
  `;
}

function renderSupportCards(items) {
  const startY = 580;
  const gap = 20;
  const height = 164;
  return items.slice(0, 3).map((item, index) => {
    const y = startY + index * (height + gap);
    const title = item.val || item.label || '';
    const eyebrow = item.label && item.label !== title ? item.label : '';
    return `
      ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height, fill: index === 0 ? CARD_ALT : CARD_BG, radius: 22 })}
      <rect x="${SIDE + 18}" y="${y + 26}" width="66" height="66" rx="18" fill="rgba(255,255,255,0.06)" />
      ${renderPathIcon({ x: SIDE + 51, y: y + 59, size: 28, color: index === 2 ? YELLOW : WHITE, token: item.ico })}
      ${eyebrow ? textBlock({ x: SIDE + 102, y: y + 18, text: eyebrow, width: WIDTH - SIDE * 2 - 128, fontSize: 18, lineHeight: 22, fill: MUTED_SOFT, weight: 800, maxLines: 1 }) : ''}
      ${fittedTextBlock({ x: SIDE + 102, y: y + (eyebrow ? 40 : 30), text: title, width: WIDTH - SIDE * 2 - 128, fontSize: 38, lineHeight: 42, fill: index === 2 ? YELLOW : WHITE, weight: 920, maxLines: 2, minFontSize: 28, fontFamily: DISPLAY_FONT })}
      ${multilinePlainText({ x: SIDE + 102, y: y + (eyebrow ? 102 : 94), text: item.desc || '', width: WIDTH - SIDE * 2 - 128, fontSize: 21, lineHeight: 29, fill: MUTED, weight: 620, maxLines: 2 })}
    `;
  }).join('');
}

function renderImpact(card, date) {
  const items = card.items || [];
  const accentColors = [
    { box: 'rgba(96,165,250,0.18)', icon: '#93c5fd' },
    { box: 'rgba(251,191,36,0.18)', icon: '#fbbf24' },
    { box: 'rgba(52,211,153,0.18)', icon: '#34d399' },
    { box: 'rgba(244,114,182,0.18)', icon: '#f472b6' }
  ];
  return `
    ${background(false)}
    ${badge(card.badge || '', RED)}
    ${fittedTextBlock({ x: SIDE, y: 118, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 68, lineHeight: 74, fill: WHITE, weight: 920, maxLines: 3, minFontSize: 48, fontFamily: DISPLAY_FONT })}
    ${items.slice(0, 4).map((item, index) => {
      const y = 292 + index * 184;
      const accent = accentColors[index % accentColors.length];
      return `
        ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height: 162, fill: CARD_BG, radius: 24 })}
        <rect x="${SIDE + 20}" y="${y + 28}" width="72" height="72" rx="20" fill="${accent.box}" stroke="rgba(255,255,255,0.05)" />
        ${renderPathIcon({ x: SIDE + 56, y: y + 64, size: 30, color: accent.icon, token: item.ico })}
        ${fittedTextBlock({ x: SIDE + 110, y: y + (item.label && item.label !== item.title ? 40 : 30), text: item.title || '', width: WIDTH - SIDE * 2 - 144, fontSize: 38, lineHeight: 42, fill: WHITE, weight: 920, maxLines: 2, minFontSize: 30, fontFamily: DISPLAY_FONT })}
        ${multilinePlainText({ x: SIDE + 110, y: y + (item.label && item.label !== item.title ? 96 : 92), text: item.desc || '', width: WIDTH - SIDE * 2 - 144, fontSize: 22, lineHeight: 30, fill: MUTED, weight: 620, maxLines: 2 })}
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
    ${fittedTextBlock({ x: SIDE, y: 118, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 68, lineHeight: 74, fill: WHITE, weight: 920, maxLines: 3, minFontSize: 48, fontFamily: DISPLAY_FONT })}
    ${items.slice(0, 3).map((item, index) => {
      const y = 300 + index * 192;
      return `
        ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height: 168, fill: index === 2 ? CARD_BG : CARD_ALT, radius: 24 })}
        <circle cx="${SIDE + 48}" cy="${y + 54}" r="28" fill="rgba(251,191,36,0.18)" />
        <text x="${SIDE + 48}" y="${y + 64}" text-anchor="middle" font-family="${UI_FONT}" font-size="30" font-weight="900" fill="${YELLOW}">${index + 1}</text>
        ${fittedTextBlock({ x: SIDE + 96, y: y + 22, text: item.title || '', width: WIDTH - SIDE * 2 - 126, fontSize: 46, lineHeight: 50, fill: WHITE, weight: 920, maxLines: 2, minFontSize: 32, fontFamily: DISPLAY_FONT })}
        ${multilinePlainText({ x: SIDE + 96, y: y + 94, text: item.desc || '', width: WIDTH - SIDE * 2 - 126, fontSize: 22, lineHeight: 30, fill: MUTED, weight: 620, maxLines: 2 })}
      `;
    }).join('')}
    ${card.warning ? `
      <rect x="${SIDE}" y="930" width="${WIDTH - SIDE * 2}" height="92" rx="16" fill="rgba(251,191,36,0.1)" />
      <rect x="${SIDE}" y="930" width="6" height="92" rx="3" fill="${YELLOW}" />
      ${textBlock({ x: SIDE + 24, y: 958, text: card.warning, width: WIDTH - SIDE * 2 - 48, fontSize: 22, lineHeight: 28, fill: '#fde68a', weight: 760, maxLines: 2 })}
    ` : ''}
    ${footer(4, date)}
  `;
}

function renderAction(card, date) {
  const items = card.items || [];
  const accentColors = [
    { box: 'rgba(52,211,153,0.18)', icon: '#34d399' },
    { box: 'rgba(96,165,250,0.18)', icon: '#93c5fd' },
    { box: 'rgba(251,191,36,0.18)', icon: '#fbbf24' },
    { box: 'rgba(244,114,182,0.18)', icon: '#f472b6' }
  ];
  return `
    ${background(false)}
    ${badge(card.badge || '', GREEN)}
    ${fittedTextBlock({ x: SIDE, y: 118, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 68, lineHeight: 74, fill: WHITE, weight: 920, maxLines: 3, minFontSize: 48, fontFamily: DISPLAY_FONT })}
    ${items.slice(0, 4).map((item, index) => {
      const y = 292 + index * 184;
      const accent = accentColors[index % accentColors.length];
      return `
        ${roundedRect({ x: SIDE, y, width: WIDTH - SIDE * 2, height: 162, fill: CARD_BG, radius: 24 })}
        <rect x="${SIDE + 20}" y="${y + 28}" width="72" height="72" rx="20" fill="${accent.box}" stroke="rgba(255,255,255,0.05)" />
        ${renderPathIcon({ x: SIDE + 56, y: y + 64, size: 30, color: accent.icon, token: item.ico })}
        ${fittedTextBlock({ x: SIDE + 110, y: y + 30, text: item.title || '', width: WIDTH - SIDE * 2 - 144, fontSize: 38, lineHeight: 42, fill: WHITE, weight: 920, maxLines: 2, minFontSize: 30, fontFamily: DISPLAY_FONT })}
        ${multilinePlainText({ x: SIDE + 110, y: y + 94, text: item.desc || '', width: WIDTH - SIDE * 2 - 144, fontSize: 22, lineHeight: 30, fill: MUTED, weight: 620, maxLines: 2 })}
      `;
    }).join('')}
    ${card.quote ? `
      <rect x="${SIDE}" y="1032" width="${WIDTH - SIDE * 2}" height="92" rx="16" fill="rgba(34,197,94,0.08)" />
      <rect x="${SIDE}" y="1032" width="6" height="92" rx="3" fill="${GREEN}" />
      ${textBlock({ x: SIDE + 22, y: 1060, text: card.quote, width: WIDTH - SIDE * 2 - 44, fontSize: 22, lineHeight: 28, fill: '#86efac', weight: 760, maxLines: 2 })}
    ` : ''}
    ${footer(5, date)}
  `;
}

function renderClosing(card, date) {
  const [summary, cta] = String(card.desc || '').split('\n\n');
  return `
    ${background(true)}
    ${lineChartIcon({ x: WIDTH / 2 - 42, y: 158, size: 84, color: YELLOW })}
    ${fittedTextBlock({ x: SIDE, y: 308, text: card.title || '', width: WIDTH - SIDE * 2, fontSize: 72, lineHeight: 80, fill: WHITE, weight: 920, anchor: 'middle', maxLines: 3, minFontSize: 46, fontFamily: DISPLAY_FONT })}
    <rect x="${SIDE + 86}" y="566" width="${WIDTH - (SIDE + 86) * 2}" height="6" rx="3" fill="rgba(251,191,36,0.85)" />
    ${multilinePlainText({ x: SIDE + 20, y: 614, text: summary || '', width: WIDTH - SIDE * 2 - 40, fontSize: 27, lineHeight: 40, fill: MUTED, weight: 640, anchor: 'middle', maxLines: 3 })}
    <rect x="${SIDE + 90}" y="770" width="${WIDTH - (SIDE + 90) * 2}" height="96" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" />
    ${fittedTextBlock({ x: SIDE + 120, y: 798, text: cta || '', width: WIDTH - (SIDE + 120) * 2, fontSize: 32, lineHeight: 38, fill: WHITE, weight: 860, anchor: 'middle', maxLines: 2, minFontSize: 26, fontFamily: DISPLAY_FONT })}
    ${renderChips(card.tags || [], 906)}
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
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
    buffers.push(jpeg.toString('base64'));
  }

  return { images: buffers, debugHtml: null };
}

module.exports = {
  renderCardsWithSvg
};
