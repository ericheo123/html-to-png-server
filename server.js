const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json({ limit: '10mb' }));

app.post('/convert', async (req, res) => {
  const { html, width = 800, height = 1000 } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html 필드가 필요해요' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1500);

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width, height }
    });

    res.set('Content-Type', 'image/png');
    res.send(screenshot);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: ${PORT}`);
});
```

**Commit changes** 클릭

---

### 4. .gitignore 추가

**Add file → Create new file**

파일명: `.gitignore`

내용:
```
node_modules/
```

**Commit changes** 클릭

---

### 완료 후 레포 모습
```
html-to-png-server/
├── .gitignore
├── package.json
├── README.md
└── server.js
