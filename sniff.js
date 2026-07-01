// 攔媒體：給一批單元網址，逐一用瀏覽器載入、攔影音來源，輸出 manifest。
// 多來源：Vimeo / SoundCloud（私人音軌含 secret_token）/ YouTube / HLS。
// 用法：node sniff.js <urls.txt> <out-manifest.json> [platformOrigin] [cdpEndpoint]
//   urls.txt：每行一個單元網址（可加「Tab+標題」）
module.paths.push(require('path').join(require('os').homedir(), 'AppData/Roaming/npm/node_modules'));
const fs = require('fs');

// 通用媒體分類器（recon.js 也會 require）
function classify(u) {
  let m;
  if ((m = u.match(/player\.vimeo\.com\/video\/(\d+)/))) return { host: 'vimeo', mediaId: m[1], downloadUrl: 'https://player.vimeo.com/video/' + m[1] };
  if (u.match(/w\.soundcloud\.com\/player\//) || u.match(/api\.soundcloud\.com\/tracks\//)) {
    try {
      const q = new URL(u).searchParams;
      const inner = q.get('url') || u;
      const tok = q.get('secret_token') || '';
      const idm = inner.match(/tracks\/(\d+)/);
      if (idm) return { host: 'soundcloud', mediaId: idm[1], secretToken: tok, downloadUrl: 'https://api.soundcloud.com/tracks/' + idm[1] + (tok ? '?secret_token=' + tok : '') };
    } catch (_) {}
  }
  if ((m = u.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/))) return { host: 'youtube', mediaId: m[1], downloadUrl: 'https://youtu.be/' + m[1] };
  if ((m = u.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/))) return { host: 'hls', mediaId: '', downloadUrl: m[1] };
  return null;
}
module.exports = { classify };

if (require.main === module) {
  const { chromium } = require('playwright');
  const URLS = process.argv[2], OUT = process.argv[3];
  const ORIGIN = process.argv[4] || '';
  const CDP = process.argv[5] || 'http://localhost:9222';
  if (!URLS || !OUT) { console.error('usage: node sniff.js <urls.txt> <out.json> [platformOrigin] [cdp]'); process.exit(1); }
  const rows = fs.readFileSync(URLS, 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const [url, title] = l.split('\t'); return { url: url.trim(), title: (title || '').trim() }; });
  const CONC = 4;
  (async () => {
    const browser = await chromium.connectOverCDP(CDP);
    const ctx = browser.contexts()[0];
    const out = new Array(rows.length);
    let i = 0;
    async function worker() {
      while (i < rows.length) {
        const idx = i++; const it = rows[idx];
        const page = await ctx.newPage();
        let found = null;
        const onUrl = u => { if (!found) { const c = classify(u); if (c) found = c; } };
        page.on('request', r => onUrl(r.url())); page.on('response', r => onUrl(r.url()));
        try {
          await page.goto(it.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          for (let k = 0; k < 16 && !found; k++) await page.waitForTimeout(500);
          if (!found) { const srcs = await page.$$eval('iframe', els => els.map(e => e.src || e.getAttribute('data-src') || '')).catch(() => []); for (const s of srcs) { const c = classify(s); if (c) { found = c; break; } } }
        } catch (_) {}
        const title = it.title || (await page.title().catch(() => '')).trim();
        await page.close();
        out[idx] = { title, url: it.url, host: found ? found.host : '', mediaId: found ? found.mediaId : '', downloadUrl: found ? found.downloadUrl : '', referer: found && found.host === 'vimeo' ? (ORIGIN || new URL(it.url).origin + '/') : '', available: !!found };
        process.stdout.write(`[${idx + 1}/${rows.length}] ${found ? found.host + ':' + found.mediaId : 'NO-MEDIA'}  ${title.slice(0, 40)}\n`);
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    fs.writeFileSync(OUT, JSON.stringify({ items: out, available: out.filter(x => x.available).length }, null, 1), 'utf8');
    console.log(`DONE: ${out.filter(x => x.available).length}/${out.length} 有媒體 → ${OUT}`);
    await browser.close();
  })().catch(e => { console.error('FATAL', e.message); process.exit(1); });
}
