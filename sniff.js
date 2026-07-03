// 攔媒體：給一批單元網址，逐一用瀏覽器載入、攔影音來源，輸出 manifest。
// 多來源：Vimeo / SoundCloud（私人音軌含 secret_token）/ YouTube / HLS。
// 用法：node sniff.js <urls.txt> <out-manifest.json> [platformOrigin] [cdpEndpoint]
//   urls.txt：每行一個單元網址（可加「Tab+標題」）
module.paths.push(require('path').join(require('os').homedir(), 'AppData/Roaming/npm/node_modules'));
const fs = require('fs');

// 通用媒體分類器（recon.js 也會 require）
function classify(u) {
  let m;
  if ((m = u.match(/player\.vimeo\.com\/video\/(\d+)/))) {
    // unlisted 影片的 hash：?h=xxxx 或 /video/<id>/<hash>
    const hm = u.match(/[?&]h=([0-9a-f]{6,})/i) || u.match(/\/video\/\d+\/([0-9a-f]{6,})/i);
    const h = hm ? hm[1] : '';
    return { host: 'vimeo', mediaId: m[1], downloadUrl: 'https://player.vimeo.com/video/' + m[1] + (h ? '?h=' + h : '') };
  }
  if (u.match(/w\.soundcloud\.com\/player\//) || u.match(/api\.soundcloud\.com\/tracks\//)) {
    try {
      const q = new URL(u).searchParams;
      const inner = q.get('url') || u;
      // secret_token 常在「內層 url 參數」裡，不是外層 query → 兩邊都找
      let tok = q.get('secret_token') || '';
      if (!tok) { try { tok = new URL(inner).searchParams.get('secret_token') || ''; } catch (_) {} }
      const idm = inner.match(/tracks\/(\d+)/);
      if (idm) return { host: 'soundcloud', mediaId: idm[1], secretToken: tok, downloadUrl: 'https://api.soundcloud.com/tracks/' + idm[1] + (tok ? '?secret_token=' + tok : '') };
    } catch (_) {}
  }
  // 涵蓋 youtube-nocookie、shorts/live/v、以及 v 不在第一個參數的 watch?...&v=
  if ((m = u.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/|youtu\.be\/|youtube\.com\/watch\?(?:[^"'\s]*&)?v=)([A-Za-z0-9_-]{11})/))) {
    if (m[1] !== 'videoseries') return { host: 'youtube', mediaId: m[1], downloadUrl: 'https://youtu.be/' + m[1] };
  }
  if ((m = u.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/))) return { host: 'hls', mediaId: '', downloadUrl: m[1] };
  return null;
}
// 一個頁面可能攔到多個候選（廣告/預告串流會早於真正播放器）→ 依可靠度挑最佳
function pickBest(hits) {
  if (!hits || !hits.length) return null;
  const rank = h => (h.host === 'vimeo' || h.host === 'soundcloud') ? 0 : h.host === 'hls' ? 1 : 2;
  return hits.slice().sort((a, b) => rank(a) - rank(b))[0];
}
module.exports = { classify, pickBest };

if (require.main === module) {
  const { chromium } = require('playwright-core');
  const URLS = process.argv[2], OUT = process.argv[3];
  const ORIGIN = process.argv[4] || '';
  const CDP = process.argv[5] || 'http://127.0.0.1:9222'; // 127.0.0.1 不用 localhost（Node<20 的 ::1 陷阱）
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
        const hits = [];
        const onUrl = u => { const c = classify(u); if (c) hits.push(c); };
        page.on('request', r => onUrl(r.url())); page.on('response', r => onUrl(r.url()));
        try {
          await page.goto(it.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          const WAIT = Math.max(1, parseInt(process.env.COURSE2NOTES_SNIFF_WAIT_S, 10) || 8) * 2; // 慢網路/SSO 可用 COURSE2NOTES_SNIFF_WAIT_S 加大
          for (let k = 0; k < WAIT && !hits.length; k++) await page.waitForTimeout(500);
          if (hits.length) await page.waitForTimeout(400); // 多等一下，收集更好的候選再挑
          if (!hits.length) { const srcs = await page.$$eval('iframe', els => els.map(e => e.src || e.getAttribute('data-src') || '')).catch(() => []); for (const s of srcs) { const c = classify(s); if (c) hits.push(c); } }
        } catch (_) {}
        const found = pickBest(hits);
        const title = it.title || (await page.title().catch(() => '')).trim();
        await page.close();
        // referer 對 vimeo-external(HLS)、Mux、Teachify 等 domain-private 串流都可能必要 → 一律帶來源站
        out[idx] = { title, url: it.url, host: found ? found.host : '', mediaId: found ? found.mediaId : '', downloadUrl: found ? found.downloadUrl : '', referer: found ? (ORIGIN || new URL(it.url).origin + '/') : '', available: !!found };
        process.stdout.write(`[${idx + 1}/${rows.length}] ${found ? found.host + ':' + found.mediaId : 'NO-MEDIA'}  ${title.slice(0, 40)}\n`);
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    fs.writeFileSync(OUT, JSON.stringify({ items: out, available: out.filter(x => x.available).length }, null, 1), 'utf8');
    console.log(`DONE: ${out.filter(x => x.available).length}/${out.length} 有媒體 → ${OUT}`);
    await browser.close();
  })().catch(e => { console.error('FATAL', e.message); process.exit(1); });
}
