const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, 'data');
const HISTORY_PATH = path.join(STATE_DIR, 'published_history.json');

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function hashText(text = '') {
  return crypto.createHash('sha1').update(String(text).trim().toLowerCase()).digest('hex');
}

function normalizeUrl(url = '') {
  try {
    const parsed = new URL(String(url).trim());
    const filtered = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!/^utm_/i.test(key) && key !== 'fbclid') {
        filtered.append(key, value);
      }
    }
    parsed.search = filtered.toString();
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(url).trim().replace(/\/$/, '').toLowerCase();
  }
}

function loadHistory() {
  ensureStateDir();
  if (!fs.existsSync(HISTORY_PATH)) {
    return { items: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {
    return { items: [] };
  }
}

function saveHistory(history) {
  ensureStateDir();
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function buildKeys({ sourceUrl = '', sourceTitle = '', topic = '', caption = '' }) {
  const normalizedSourceUrl = normalizeUrl(sourceUrl);
  return {
    sourceUrl: normalizedSourceUrl,
    sourceUrlHash: hashText(normalizedSourceUrl),
    sourceTitle: String(sourceTitle || '').trim(),
    sourceTitleHash: hashText(sourceTitle),
    topicHash: hashText(topic),
    captionHash: hashText(caption)
  };
}

function findDuplicate(history, keys) {
  return (history.items || []).find((item) => {
    return (
      (keys.sourceUrl && item.sourceUrl === keys.sourceUrl) ||
      (keys.sourceUrlHash && item.sourceUrlHash === keys.sourceUrlHash)
    );
  });
}

function appendHistory(entry) {
  const history = loadHistory();
  history.items = Array.isArray(history.items) ? history.items : [];
  history.items.unshift(entry);
  history.items = history.items.slice(0, 1000);
  saveHistory(history);
}

module.exports = {
  HISTORY_PATH,
  buildKeys,
  loadHistory,
  findDuplicate,
  appendHistory
};
