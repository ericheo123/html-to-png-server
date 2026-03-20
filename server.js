const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

function buildHTML(d) {
  const today = d.date || new Date().toISOString().slice(0,10).replace(/-/g,'.');

  const chips = (arr) => arr.map(c => `<div class="chip">${c}</div>`).join('');
  const ctags = (arr) => arr.map(c => `<div class="ctag">${c}</div>`).join('');

  const siItems = (arr) => arr.map(i => `
    <div class="si${i.highlight?' hi':''}">
      <div class="si-ico">${i.ico}</div>
      <div>
        <div class="si-lbl">${i.label}</div>
        <div class="si-val${i.amber?' a':''}">${i.val}</div>
        <div class="si-desc">${i.desc}</div>
      </div>
    </div>`).join('');

  const iiItems = (arr) => arr.map(i => `
    <div class="ii">
      <div class="ii-ico">${i.ico}</div>
      <div>
        <div class="ii-t">${i.title}</div>
        <div class="ii-d">${i.desc}</div>
      </div>
    </div>`).join('');

  const ciItems = (arr) => arr.map((i,idx) => `
    <div class="ci${idx<2?' hi':''}">
      <div class="c-n">${idx+1}</div>
      <div>
        <div class="c-t">${i.title}</div>
        <div class="c-d">${i.desc}</div>
      </div>
    </div>`).join('');

  const aiItems = (arr) => arr.map(i => `
    <div class="ai">
      <div class="a-ico">${i.ico}</div>
      <div>
        <div class="a-t">${i.title}</div>
        <div class="a-d">${i.desc}</div>
      </div>
    </div>`).join('');

  const bb = (num) => `
    <div class="bb">
      <span class="bb-name">오늘의 이슈</span>
      <span class="bb-no">0${num} / 06</span>
      <span class="bb-date">${today}</span>
    </div>`;

  const c1 = d.card1, c2 = d.card2, c3 = d.card3;
  const c4 = d.card4, c5 = d.card5, c6 = d.card6;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --font:'Pretendard',sans-serif;
  --a:#f59e0b;--r:#ef4444;--g:#22c55e;--b:#3b82f6;
  --bg:#111827;--bo:rgba(255,255,255,0.08);--t:#fff;
  --m:rgba(255,255,255,0.5);--m2:rgba(255,255,255,0.78);
  --W:800px;--H:1000px;
  --fs-hero:130px;--fs-h1:68px;--fs-h2:48px;--fs-h3:34px;
  --fs-body:24px;--fs-small:20px;--fs-label:15px;--fs-brand:13px
}
body{background:#080c14;font-family:var(--font);padding:40px 16px;display:flex;flex-direction:column;align-items:center;gap:40px}
.card{width:var(--W);height:var(--H);background:var(--bg);border-radius:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 100px rgba(0,0,0,0.85);font-family:var(--font)}
.bb{position:absolute;bottom:0;left:0;right:0;padding:20px 44px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--bo);background:rgba(0,0,0,0.6);z-index:10}
.bb-name{font-size:var(--fs-brand);font-weight:800;color:var(--r);letter-spacing:2.5px;text-transform:uppercase}
.bb-date{font-size:var(--fs-brand);color:var(--m);font-weight:500}
.bb-no{font-size:16px;font-weight:800;color:var(--m);letter-spacing:1px}
.badge{display:inline-block;font-size:var(--fs-label);font-weight:800;letter-spacing:1px;padding:8px 20px;border-radius:6px;text-transform:uppercase;margin-bottom:20px}
.badge.red{background:var(--r);color:#fff}.badge.amb{background:var(--a);color:#000}.badge.grn{background:var(--g);color:#000}
.ctitle{font-size:var(--fs-h1);font-weight:900;color:var(--t);line-height:1.2;margin-bottom:28px;word-break:keep-all}
.ctitle em{color:var(--r);font-style:normal}.ctitle em.a{color:var(--a)}
/* C1 */
.c1{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;padding:52px 56px 88px}
.c1 .g1{position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.25) 0%,transparent 62%);top:-220px;right:-200px}
.c1 .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px);background-size:50px 50px}
.c1 .inner{position:relative;z-index:1}
.c1 .hero{font-size:var(--fs-hero);font-weight:900;color:var(--r);line-height:0.88;letter-spacing:-2px;margin-bottom:16px;text-shadow:0 0 100px rgba(239,68,68,0.6)}
.c1 .hero2{font-size:66px;font-weight:900;color:var(--t);line-height:1.1;margin-bottom:24px;word-break:keep-all}
.c1 .hero2 em{color:var(--a);font-style:normal}
.c1 .bar{width:64px;height:6px;background:var(--r);border-radius:3px;margin-bottom:24px}
.c1 .sub{font-size:var(--fs-body);color:var(--m);line-height:1.7;margin-bottom:28px;font-weight:500;word-break:keep-all}
.chips{display:flex;gap:10px;flex-wrap:wrap}
.chip{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:var(--m);font-size:var(--fs-label);font-weight:600;padding:7px 18px;border-radius:99px}
/* C2 */
.c2{padding:52px 52px 88px}
.slist{display:flex;flex-direction:column;gap:18px;flex:1;justify-content:center}
.si{border-radius:16px;padding:24px 28px;display:flex;align-items:center;gap:24px;border:1px solid var(--bo);background:rgba(255,255,255,0.03)}
.si.hi{background:rgba(239,68,68,0.07);border-color:rgba(239,68,68,0.25)}
.si-ico{font-size:42px;flex-shrink:0}
.si-lbl{font-size:var(--fs-label);font-weight:700;color:var(--m);margin-bottom:7px}
.si-val{font-size:var(--fs-h2);font-weight:900;color:var(--r);line-height:1.1}
.si-val.a{color:var(--a)}
.si-desc{font-size:var(--fs-small);color:var(--m);margin-top:6px;font-weight:500;word-break:keep-all}
/* C3 */
.c3{padding:52px 52px 88px}
.ilist{display:flex;flex-direction:column;gap:13px;flex:1;justify-content:center}
.ii{border-radius:14px;padding:18px 22px;display:flex;gap:14px;align-items:flex-start;background:rgba(255,255,255,0.03);border:1px solid var(--bo)}
.ii-ico{font-size:32px;flex-shrink:0;padding-top:2px}
.ii-t{font-size:var(--fs-h3);font-weight:900;color:var(--t);margin-bottom:5px;line-height:1.2;word-break:keep-all}
.ii-d{font-size:var(--fs-small);color:var(--m);line-height:1.5;font-weight:500;word-break:keep-all}
/* C4 */
.c4{padding:52px 52px 88px}
.clist{display:flex;flex-direction:column;gap:16px;flex:1;justify-content:center}
.ci{border-radius:14px;padding:22px 26px;display:flex;gap:18px;align-items:flex-start;border:1px solid var(--bo);background:rgba(255,255,255,0.03)}
.ci.hi{border-color:rgba(239,68,68,0.28);background:rgba(239,68,68,0.05)}
.c-n{width:40px;height:40px;border-radius:50%;background:var(--r);color:#fff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.c-t{font-size:var(--fs-h3);font-weight:900;color:var(--t);margin-bottom:7px;line-height:1.2;word-break:keep-all}
.c-d{font-size:var(--fs-small);color:var(--m);line-height:1.6;font-weight:500;word-break:keep-all}
.ws{background:rgba(245,158,11,0.08);border-left:5px solid var(--a);border-radius:0 12px 12px 0;padding:18px 22px;font-size:var(--fs-body);color:#fde68a;line-height:1.7;font-weight:500;word-break:keep-all;margin-top:4px}
.ws strong{color:var(--a);font-weight:900}
/* C5 */
.c5{padding:52px 52px 88px}
.alist{display:flex;flex-direction:column;gap:14px;flex:1;justify-content:center}
.ai{border-radius:14px;padding:20px 24px;background:rgba(255,255,255,0.03);border:1px solid var(--bo);display:flex;gap:16px;align-items:flex-start}
.a-ico{font-size:30px;flex-shrink:0;padding-top:2px}
.a-t{font-size:var(--fs-h3);font-weight:900;color:var(--t);margin-bottom:6px;line-height:1.2;word-break:keep-all}
.a-d{font-size:var(--fs-small);color:var(--m);line-height:1.6;font-weight:500;word-break:keep-all}
.gq{background:rgba(34,197,94,0.07);border-left:5px solid var(--g);border-radius:0 12px 12px 0;padding:18px 24px;font-size:var(--fs-body);color:#86efac;line-height:1.7;margin-top:14px;font-weight:600;word-break:keep-all}
/* C6 */
.c6{background:linear-gradient(155deg,#1a0000 0%,#2d0500 45%,#080c14 100%);justify-content:center;align-items:center;text-align:center;padding:52px 56px 88px}
.c6 .g1{position:absolute;width:650px;height:650px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,0.18) 0%,transparent 62%);top:-200px;left:50%;transform:translateX(-50%)}
.c6 .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(239,68,68,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.03) 1px,transparent 1px);background-size:50px 50px}
.c6 .inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center}
.c6 .ico{font-size:86px;margin-bottom:26px}
.c6 .ft{font-size:var(--fs-h1);font-weight:900;color:var(--t);line-height:1.25;margin-bottom:22px;word-break:keep-all}
.c6 .ft em{color:var(--r);font-style:normal}
.c6 .fd{font-size:var(--fs-body);color:var(--m);line-height:1.9;margin-bottom:34px;font-weight:500;word-break:keep-all}
.c6 .fd strong{color:var(--a);font-weight:900}
.ctags{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.ctag{background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;font-size:var(--fs-label);font-weight:700;padding:9px 22px;border-radius:99px}
</style>
</head>
<body>

<!-- CARD 1 -->
<div class="card c1" id="card-1">
  <div class="g1"></div><div class="grid"></div>
  <div class="inner">
    <div class="hero">${c1.hero}</div>
    <div class="hero2">${c1.hero2.replace(/\n/g,'<br>')}</div>
    <div class="bar"></div>
    <div class="sub">${c1.sub.replace(/\n/g,'<br>')}</div>
    <div class="chips">${chips(c1.chips)}</div>
  </div>
  ${bb(1)}
</div>

<!-- CARD 2 -->
<div class="card c2" id="card-2">
  <div class="badge red">${c2.badge}</div>
  <div class="ctitle">${c2.title.replace(/\n/g,'<br>')}</div>
  <div class="slist">${siItems(c2.items)}</div>
  ${bb(2)}
</div>

<!-- CARD 3 -->
<div class="card c3" id="card-3">
  <div class="badge red">${c3.badge}</div>
  <div class="ctitle">${c3.title.replace(/\n/g,'<br>')}</div>
  <div class="ilist">${iiItems(c3.items)}</div>
  ${bb(3)}
</div>

<!-- CARD 4 -->
<div class="card c4" id="card-4">
  <div class="badge red">${c4.badge}</div>
  <div class="ctitle">${c4.title.replace(/\n/g,'<br>')}</div>
  <div class="clist">${ciItems(c4.items)}</div>
  <div class="ws">${c4.warning}</div>
  ${bb(4)}
</div>

<!-- CARD 5 -->
<div class="card c5" id="card-5">
  <div class="badge grn">${c5.badge}</div>
  <div class="ctitle">${c5.title.replace(/\n/g,'<br>')}</div>
  <div class="alist">${aiItems(c5.items)}</div>
  <div class="gq">${c5.quote}</div>
  ${bb(5)}
</div>

<!-- CARD 6 -->
<div class="card c6" id="card-6">
  <div class="g1"></div><div class="grid"></div>
  <div class="inner">
    <div class="ico">${c6.ico}</div>
    <div class="ft">${c6.title.replace(/\n/g,'<br>')}</div>
    <div class="fd">${c6.desc.replace(/\n/g,'<br>')}</div>
    <div class="ctags">${ctags(c6.tags)}</div>
  </div>
  ${bb(6)}
</div>

</body>
</html>`;
}

// 메인: JSON 데이터 → 6장 PNG 배열 반환
app.post('/generate', async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data 필드가 필요합니다' });

  let browser;
  try {
    browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: { width: 1200, height: 9000 },
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 9000 });
    await page.setContent(buildHTML(data), { waitUntil: 'networkidle0', timeout: 30000 });

    const images = [];
    for (let i = 1; i <= 6; i++) {
      const el = await page.$(`#card-${i}`);
      if (!el) throw new Error(`card-${i} 요소를 찾을 수 없습니다`);
      const screenshot = await el.screenshot({ type: 'png' });
      images.push(screenshot.toString('base64'));
    }

    res.json({ images, count: images.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 서버 실행 중: port ${PORT}`));
