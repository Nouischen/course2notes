// 偵察起手式：連 CDP、載入課程/單元頁，dump 連結路徑樣式 + 偵測媒體來源。
// 給 agent 用來「看懂一個新平台」再決定列舉策略。用法：node recon.js <url>
module.paths.push(require('path').join(require('os').homedir(), 'AppData/Roaming/npm/node_modules'));
try { require.resolve('playwright-core'); } catch (_) { module.paths.push('/usr/local/lib/node_modules', '/usr/lib/node_modules'); }
const { chromium } = require('playwright-core');
const { classify } = require('./sniff.js');

const URL_ = process.argv[2];
const CDP = process.argv[3] || 'http://localhost:9222';
if (!URL_) { console.error('usage: node recon.js <url> [cdpEndpoint]'); process.exit(1); }

(async () => {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const media = new Set();
  const onUrl = u => { const c = classify(u); if (c) media.add(c.host + ':' + c.mediaId); };
  page.on('request', r => onUrl(r.url()));
  page.on('response', r => onUrl(r.url()));

  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500); // 等 JS 注入播放器
  console.log('TITLE:', await page.title());
  console.log('URL  :', page.url());
  const loggedOut = /login|sign_?in|登入/i.test(page.url());
  console.log('可能未登入:', loggedOut);

  // 連結路徑樣式（把 id/數字段換成 :id，看出結構）
  const links = await page.$$eval('a[href]', as => as.map(a => a.href));
  const host = new URL(URL_).host;
  const shapes = {};
  for (const h of links) {
    try { const u = new URL(h); if (u.host !== host) continue;
      const shape = '/' + u.pathname.split('/').filter(Boolean).map(s => /^[0-9a-f-]{8,}$/i.test(s) || /^\d+$/.test(s) ? ':id' : s).join('/');
      shapes[shape] = (shapes[shape] || 0) + 1;
    } catch (_) {}
  }
  console.log('\n=== 連結路徑樣式（次數）===');
  Object.entries(shapes).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([s, n]) => console.log(String(n).padStart(4), s));

  // iframe 來源（有些平台把播放器放 iframe）
  const iframes = await page.$$eval('iframe', els => els.map(e => e.src || e.getAttribute('data-src') || '').filter(Boolean));
  console.log('\n=== iframe ===');
  iframes.forEach(s => console.log(' ', s));

  console.log('\n=== 偵測到的媒體 ===');
  console.log(media.size ? [...media].join('\n') : '(這頁沒抓到影音媒體 → 可能是總覽頁、純文字課、或播放器要互動才載入)');

  await page.close();
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
