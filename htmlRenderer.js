const { launch } = require('puppeteer-core');

const WIDTH = 1080;
const HEIGHT = 1350;

function esc(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value = '') {
  return esc(value).replace(/\n/g, '<br />');
}

function withHighlights(value = '') {
  return esc(String(value || '')).replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>');
}

function cardFooter(index, date) {
  return `
    <footer class="card-footer">
      <span class="footer-left">TODAY BRIEF</span>
      <span class="footer-mid">${String(index).padStart(2, '0')} / 06</span>
      <span class="footer-right">${esc(date || '')}</span>
    </footer>
  `;
}

function renderCover(card, index, date) {
  return `
    <section class="card-slide cover tone-red">
      <div class="card-inner">
        <div class="eyebrow pill">${esc(card.eyebrow || '')}</div>
        <div class="cover-main">${withHighlights(card.hero || '')}</div>
        <h1 class="cover-title">${withHighlights(card.hero2 || '')}</h1>
        <p class="cover-sub">${nl2br(card.sub || '')}</p>
        <div class="chip-row">
          ${(card.chips || []).map((chip) => `<span class="chip">${esc(chip)}</span>`).join('')}
        </div>
      </div>
      ${cardFooter(index, date)}
    </section>
  `;
}

function renderStats(card, index, date) {
  const items = card.items || [];
  return `
    <section class="card-slide tone-blue">
      <div class="card-inner">
        <div class="section-label">${esc(card.badge || '핵심 팩트')}</div>
        <h2 class="section-title">${withHighlights(card.title || '')}</h2>
        <div class="hero-box">
          <div class="hero-label">${esc(card.hero?.label || '')}</div>
          <div class="hero-value">${withHighlights(card.hero?.title || '')}</div>
          <div class="hero-desc">${nl2br(card.hero?.desc || '')}</div>
        </div>
        <div class="stats-grid">
          ${items.map((item) => `
            <article class="mini-card ${item.highlight ? 'highlight' : ''} ${item.amber ? 'amber' : ''}">
              <div class="mini-label">${esc(item.label || '')}</div>
              <div class="mini-value">${withHighlights(item.val || '')}</div>
              <div class="mini-desc">${nl2br(item.desc || '')}</div>
            </article>
          `).join('')}
        </div>
      </div>
      ${cardFooter(index, date)}
    </section>
  `;
}

function renderImpact(card, index, date) {
  return `
    <section class="card-slide tone-violet">
      <div class="card-inner">
        <div class="section-label">${esc(card.badge || '배경·원인')}</div>
        <h2 class="section-title">${withHighlights(card.title || '')}</h2>
        <div class="list-stack">
          ${(card.items || []).map((item) => `
            <article class="list-card">
              <div class="list-top">
                <span class="list-label">${esc(item.label || '')}</span>
                <span class="list-value">${withHighlights(item.title || '')}</span>
              </div>
              <p class="list-desc">${nl2br(item.desc || '')}</p>
            </article>
          `).join('')}
        </div>
      </div>
      ${cardFooter(index, date)}
    </section>
  `;
}

function renderCauses(card, index, date) {
  return `
    <section class="card-slide tone-slate">
      <div class="card-inner">
        <div class="section-label">${esc(card.badge || '상세 흐름')}</div>
        <h2 class="section-title">${withHighlights(card.title || '')}</h2>
        <div class="timeline">
          ${(card.items || []).map((item, idx) => `
            <article class="timeline-item ${item.highlight ? 'highlight' : ''}">
              <div class="timeline-num">0${idx + 1}</div>
              <div class="timeline-copy">
                <div class="timeline-title">${withHighlights(item.title || '')}</div>
                <div class="timeline-desc">${nl2br(item.desc || '')}</div>
              </div>
            </article>
          `).join('')}
        </div>
        <div class="warning-box">${nl2br(card.warning || '')}</div>
      </div>
      ${cardFooter(index, date)}
    </section>
  `;
}

function renderAction(card, index, date) {
  return `
    <section class="card-slide tone-green">
      <div class="card-inner">
        <div class="section-label">${esc(card.badge || '영향·대응')}</div>
        <h2 class="section-title">${withHighlights(card.title || '')}</h2>
        <div class="action-grid">
          ${(card.items || []).map((item) => `
            <article class="action-card">
              <div class="action-title">${esc(item.title || '')}</div>
              <div class="action-desc">${nl2br(item.desc || '')}</div>
            </article>
          `).join('')}
        </div>
        <div class="closing-line">${nl2br(card.quote || '')}</div>
      </div>
      ${cardFooter(index, date)}
    </section>
  `;
}

function renderClosing(card, index, date) {
  const [summary, cta] = String(card.desc || '').split('\n\n');
  return `
    <section class="card-slide closing tone-red">
      <div class="card-inner closing-inner">
        <div class="closing-icon">●</div>
        <h2 class="closing-title">${withHighlights(card.title || '')}</h2>
        <p class="closing-summary">${withHighlights(summary || '')}</p>
        <p class="closing-cta">${withHighlights(cta || '')}</p>
        <div class="chip-row center">
          ${(card.tags || []).map((chip) => `<span class="chip">${esc(chip)}</span>`).join('')}
        </div>
      </div>
      ${cardFooter(index, date)}
    </section>
  `;
}

function buildHtml(normalized) {
  const cards = [
    renderCover(normalized.card1, 1, normalized.date),
    renderStats(normalized.card2, 2, normalized.date),
    renderImpact(normalized.card3, 3, normalized.date),
    renderCauses(normalized.card4, 4, normalized.date),
    renderAction(normalized.card5, 5, normalized.date),
    renderClosing(normalized.card6, 6, normalized.date),
  ].join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(normalized.topic || 'Instagram Preview')}</title>
  <style>
    :root {
      --bg: #0b1220;
      --bg-soft: #131c2f;
      --line: rgba(255,255,255,0.10);
      --text: #f8fafc;
      --muted: rgba(248,250,252,0.72);
      --yellow: #fbbf24;
      --red: #fb7185;
      --blue: #60a5fa;
      --violet: #a78bfa;
      --green: #4ade80;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #050816;
      font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      color: var(--text);
    }
    .stage {
      display: grid;
      gap: 28px;
      padding: 28px;
      justify-content: center;
    }
    .card-slide {
      position: relative;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background:
        radial-gradient(circle at 82% 14%, rgba(251,113,133,0.20), transparent 34%),
        linear-gradient(180deg, #111827 0%, #0b1220 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 30px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.42);
    }
    .tone-blue { background:
      radial-gradient(circle at 82% 14%, rgba(96,165,250,0.18), transparent 34%),
      linear-gradient(180deg, #111827 0%, #0b1220 100%); }
    .tone-violet { background:
      radial-gradient(circle at 82% 14%, rgba(167,139,250,0.18), transparent 34%),
      linear-gradient(180deg, #111827 0%, #0b1220 100%); }
    .tone-green { background:
      radial-gradient(circle at 82% 14%, rgba(74,222,128,0.18), transparent 34%),
      linear-gradient(180deg, #111827 0%, #0b1220 100%); }
    .tone-slate { background:
      radial-gradient(circle at 82% 14%, rgba(251,191,36,0.16), transparent 34%),
      linear-gradient(180deg, #111827 0%, #0b1220 100%); }
    .card-slide::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 64px 64px;
      opacity: 0.35;
      pointer-events: none;
    }
    .card-inner {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 22px;
      height: calc(100% - 96px);
      padding: 54px 58px 30px;
    }
    .pill, .section-label, .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      border-radius: 999px;
      border: 1px solid rgba(251,191,36,0.18);
      background: rgba(251,191,36,0.10);
      color: var(--yellow);
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 10px 18px;
    }
    .section-label { margin-bottom: 4px; }
    .cover-main {
      font-size: 122px;
      line-height: 0.92;
      font-weight: 900;
      letter-spacing: -0.05em;
    }
    .cover-title, .section-title, .closing-title {
      margin: 0;
      font-size: 58px;
      line-height: 1.08;
      letter-spacing: -0.03em;
      font-weight: 800;
    }
    .cover-sub, .hero-desc, .mini-desc, .list-desc, .timeline-desc, .action-desc, .warning-box, .closing-summary, .closing-cta, .closing-line {
      margin: 0;
      font-size: 28px;
      line-height: 1.55;
      color: var(--muted);
      white-space: pre-wrap;
    }
    .cover-sub { margin-top: 8px; max-width: 860px; }
    .chip-row {
      margin-top: auto;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .chip-row.center { justify-content: center; margin-top: 12px; }
    .chip {
      border-color: rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.78);
      font-size: 19px;
      padding: 12px 18px;
    }
    .hl { color: var(--yellow); }
    .hero-box, .warning-box, .closing-line {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.05);
      border-radius: 26px;
      padding: 28px 30px;
    }
    .hero-label, .mini-label, .list-label, .action-title, .timeline-num {
      font-size: 22px;
      font-weight: 700;
      color: rgba(255,255,255,0.65);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .hero-value, .mini-value, .list-value, .timeline-title {
      font-size: 42px;
      line-height: 1.12;
      font-weight: 800;
      margin-top: 10px;
    }
    .stats-grid, .action-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .mini-card, .action-card, .list-card, .timeline-item {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      border-radius: 24px;
      padding: 24px 24px 22px;
    }
    .mini-card.highlight, .timeline-item.highlight { background: rgba(251,191,36,0.08); }
    .mini-card.amber { background: rgba(251,113,133,0.08); }
    .list-stack, .timeline {
      display: grid;
      gap: 16px;
    }
    .list-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 20px;
    }
    .timeline-item {
      display: grid;
      grid-template-columns: 84px 1fr;
      gap: 18px;
      align-items: start;
    }
    .timeline-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 66px;
      height: 66px;
      border-radius: 999px;
      background: rgba(251,191,36,0.12);
      color: var(--yellow);
      font-size: 24px;
    }
    .closing {
      text-align: center;
    }
    .closing-inner {
      align-items: center;
      justify-content: center;
      gap: 22px;
    }
    .closing-icon {
      width: 84px;
      height: 84px;
      border-radius: 999px;
      background: rgba(251,191,36,0.14);
      color: var(--yellow);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 34px;
      font-weight: 900;
    }
    .card-footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 96px;
      padding: 0 58px;
      background: rgba(0,0,0,0.45);
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .footer-left { color: var(--yellow); }
    .footer-mid { color: rgba(255,255,255,0.72); }
    .footer-right { color: rgba(255,255,255,0.52); }
  </style>
</head>
<body>
  <main class="stage">
    ${cards}
  </main>
</body>
</html>`;
}

function chromeExecutableCandidates() {
  return [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

async function launchBrowser() {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  let lastError;

  for (const executablePath of chromeExecutableCandidates()) {
    try {
      return await withTimeout(
        launch({
          headless: true,
          executablePath,
          pipe: true,
          protocolTimeout: 20000,
          args: [
            ...args,
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
          ],
        }),
        12000,
        `browser launch (${executablePath})`
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No compatible Chromium executable found');
}

async function renderCardsWithHtml(normalized) {
  const html = buildHtml(normalized);
  const browser = await launchBrowser();

  try {
    return await withTimeout((async () => {
      const page = await browser.newPage({
        viewport: { width: 1240, height: 1600, deviceScaleFactor: 2 },
      });
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        }
      });
      await page.waitForTimeout(150);

      const cards = await page.$$('.card-slide');
      const images = [];
      for (const card of cards) {
        const screenshot = await card.screenshot({ type: 'jpeg', quality: 92, omitBackground: false });
        images.push(Buffer.from(screenshot).toString('base64'));
      }

      return { images, debugHtml: html };
    })(), 20000, 'html render');
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  renderCardsWithHtml,
};
