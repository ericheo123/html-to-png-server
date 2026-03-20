const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

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
  const impactItems = (arr = []) => arr.map((i) => `
    <div class="ii">
      <div class="ii-ico">${i.ico || ''}</div>
      <div>
        <div class="ii-t">${i.title || ''}</div>
        <div class="ii-d">${br(i.desc || '')}</div>
      </div>
    </div>`).join('');
  const causeItems = (arr = []) => arr.map((i, idx) => `
    <div class="ci${i.highlight || idx < 2 ? ' hi' : ''}">
      <div class="c-n">${idx + 1}</div>
      <div>
        <div class="c-t">${i.title || ''}</div>
        <div class="c-d">${br(i.desc || '')}</div>
      </div>
    </div>`).join('');
  const actionItems = (arr = []) => arr.map((i) => `
    <div class="ai">
      <div class="a-ico">${i.ico || ''}</div>
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

  const c1 = d.card1 || { hero: '', hero2: '', sub: '', chips: [] };
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
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --font:'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo','Nanum Gothic',sans-serif;
  --a:#f59e0b;--r:#ef4444;--g:#22c55e;
  --bg:#111827;--bo:rgba(255,255,255,0.08);--t:#fff;
  --m:rgba(255,255,255,0.58);--m2:rgba(255,255,255,0.78);
  --W:800px;--H:1000px;
  --fs-hero:120px;--fs-h1:58px;--fs-h2:42px;--fs-h3:29px;
  --fs-body:22px;--fs-small:18px;--fs-label:15px;--fs-brand:13px
}
body{background:#080c14;font-family:var(--font);padding:40px 16px;display:flex;flex-direction:column;align-items:center;gap:40px}
.card{width:var(--W);height:var(--H);background:var(--bg);border-radius:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 100px rgba(0,0,0,0.85);font-family:var(--font)}
.bb{position:absolute;bottom:0;left:0;right:0;padding:20px 44px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--bo);background:rgba(0,0,0,0.6);z-index:10}
.bb-name{font-size:var(--fs-brand);font-weight:800;color:var(--r);letter-spacing:2.5px;text-transform:uppercase}
.bb-date{font-size:var(--fs-brand);color:var(--m);font-weight:500}
.bb-no{font-size:16px;font-weight:800;color:var(--m);letter-spacing:1px}
.badge{display:inline-block;font-size:var(--fs-label);font-weight:800;letter-spacing:1px;padding:8px 20px;border-radius:999px;text-transform:uppercase;margin-bottom:20px}
.badge.red{background:var(--r);color:#fff}.badge.amb{background:var(--a);color:#000}.badge.grn{background:var(--g);color:#000}
.ctitle{font-size:var(--fs-h1);font-weight:900;color:var(--t);line-height:1.22;margin-bottom:24px;word-break:keep-all;letter-spacing:-0.03em}
.ctitle em{color:var(--r);font-style:normal}.ctitle em.a{color:var(--a)}
.c1{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;padding:52px 56px 88px}
.c1 .g1{position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.25) 0%,transparent 62%);top:-220px;right:-200px}
.c1 .grid,.c6 .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px);background-size:50px 50px}
.c1 .inner,.c6 .inner{position:relative;z-index:1}
.c1 .hero{font-size:var(--fs-hero);font-weight:900;color:var(--r);line-height:0.88;letter-spacing:-2px;margin-bottom:16px;text-shadow:0 0 100px rgba(239,68,68,0.6)}
.c1 .hero2{font-size:56px;font-weight:900;color:var(--t);line-height:1.18;margin-bottom:24px;word-break:keep-all}
.c1 .hero2 em{color:var(--a);font-style:normal}
.c1 .bar{width:64px;height:6px;background:var(--r);border-radius:3px;margin-bottom:24px}
.c1 .sub{font-size:var(--fs-body);color:var(--m);line-height:1.8;margin-bottom:28px;font-weight:500;word-break:keep-all}
.chips,.ctags{display:flex;gap:10px;flex-wrap:wrap}
.chip{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:var(--m2);font-size:var(--fs-label);font-weight:700;padding:7px 18px;border-radius:99px}
.c2,.c3,.c4,.c5{padding:46px 48px 88px}
.slist,.ilist,.clist,.alist{display:flex;flex-direction:column;flex:1;justify-content:center}
.slist{gap:14px}.ilist{gap:10px}.clist{gap:13px}.alist{gap:12px}
.si,.ii,.ci,.ai{border-radius:16px;border:1px solid var(--bo);background:rgba(255,255,255,0.03)}
.si{padding:20px 22px;display:flex;align-items:center;gap:18px}
.si.hi{background:rgba(239,68,68,0.07);border-color:rgba(239,68,68,0.25)}
.si-ico{font-size:30px;flex-shrink:0;min-width:44px}
.si-lbl{font-size:var(--fs-label);font-weight:700;color:var(--m);margin-bottom:7px}
.si-val{font-size:var(--fs-h2);font-weight:900;color:var(--r);line-height:1.1}
.si-val.a{color:var(--a)}
.si-desc{font-size:var(--fs-small);color:var(--m);margin-top:6px;font-weight:500;word-break:keep-all;line-height:1.6}
.ii{padding:15px 18px;display:flex;gap:12px;align-items:flex-start}
.ii-ico{font-size:24px;flex-shrink:0;padding-top:2px;min-width:44px}
.ii-t{font-size:var(--fs-h3);font-weight:900;color:var(--t);margin-bottom:5px;line-height:1.2;word-break:keep-all}
.ii-d{font-size:17px;color:var(--m);line-height:1.58;font-weight:500;word-break:keep-all}
.ci{padding:18px 20px;display:flex;gap:14px;align-items:flex-start}
.ci.hi{border-color:rgba(239,68,68,0.28);background:rgba(239,68,68,0.05)}
.c-n{width:36px;height:36px;border-radius:50%;background:var(--r);color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.c-t{font-size:var(--fs-h3);font-weight:900;color:var(--t);margin-bottom:7px;line-height:1.2;word-break:keep-all}
.c-d{font-size:17px;color:var(--m);line-height:1.58;font-weight:500;word-break:keep-all}
.ws{background:rgba(245,158,11,0.08);border-left:5px solid var(--a);border-radius:0 12px 12px 0;padding:14px 18px;font-size:18px;color:#fde68a;line-height:1.65;font-weight:500;word-break:keep-all;margin-top:4px}
.ws strong{color:var(--a);font-weight:900}
.ai{padding:16px 18px;display:flex;gap:12px;align-items:flex-start}
.a-ico{font-size:24px;flex-shrink:0;padding-top:2px;min-width:44px}
.a-t{font-size:var(--fs-h3);font-weight:900;color:var(--t);margin-bottom:6px;line-height:1.2;word-break:keep-all}
.a-d{font-size:17px;color:var(--m);line-height:1.58;font-weight:500;word-break:keep-all}
.gq{background:rgba(34,197,94,0.07);border-left:5px solid var(--g);border-radius:0 12px 12px 0;padding:14px 18px;font-size:18px;color:#86efac;line-height:1.65;margin-top:12px;font-weight:600;word-break:keep-all}
.c6{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;align-items:center;text-align:center;padding:52px 56px 88px}
.c6 .g1{position:absolute;width:650px;height:650px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.18) 0%,transparent 62%);top:-200px;left:50%;transform:translateX(-50%)}
.c6 .inner{display:flex;flex-direction:column;align-items:center}
.c6 .ico{font-size:64px;margin-bottom:24px}
.c6 .ft{font-size:54px;font-weight:900;color:var(--t);line-height:1.24;margin-bottom:20px;word-break:keep-all}
.c6 .ft em{color:var(--r);font-style:normal}
.c6 .fd{font-size:21px;color:var(--m);line-height:1.8;margin-bottom:30px;font-weight:500;word-break:keep-all}
.c6 .fd strong{color:var(--a);font-weight:900}
.ctag{background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;font-size:var(--fs-label);font-weight:700;padding:9px 22px;border-radius:99px}
</style>
</head>
<body>

<div class="card c1" id="card-1">
  <div class="g1"></div><div class="grid"></div>
  <div class="inner">
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
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'data field is required' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 9000 });

    await page.setContent(buildHTML(data), {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise((r) => setTimeout(r, 2000));

    const images = [];
    for (let i = 1; i <= 6; i += 1) {
      const el = await page.$(`#card-${i}`);
      if (!el) {
        throw new Error(`card-${i} element not found`);
      }

      const screenshot = await el.screenshot({ type: 'png' });
      images.push(screenshot.toString('base64'));
    }

    res.json({ images, count: images.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('browser close error:', closeErr);
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server listening on port ${PORT}`));
