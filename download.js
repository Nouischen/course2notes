// 下載音訊（audio-only）：讀 sniff 產的 manifest，逐項用 yt-dlp 抓。
// 多來源眉角：Vimeo 私人嵌入帶 referer；SoundCloud 私人音軌帶 secret_token（已在 downloadUrl）；YouTube/HLS 直接抓。
// 用法：node download.js <manifest.json> <audio_dir>
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAN = process.argv[2], AUD = process.argv[3];
if (!MAN || !AUD) { console.error('usage: node download.js <manifest.json> <audio_dir>'); process.exit(1); }
fs.mkdirSync(AUD, { recursive: true });
const items = JSON.parse(fs.readFileSync(MAN, 'utf8')).items.filter(x => x.available && x.downloadUrl);
console.log(`${items.length} 項待下載`);

const DL_TIMEOUT = (parseInt(process.env.COURSE2NOTES_DL_TIMEOUT_MIN, 10) || 20) * 60 * 1000; // 每項預設 20 分鐘上限；很長的課／慢網路可用 COURSE2NOTES_DL_TIMEOUT_MIN 調大

// 找可用的 Python 直譯器：Windows 常見 python/py，Mac/Linux 常只有 python3（寫死 'python' 會讓 Mac 全滅）
const PY_CANDIDATES = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
let PY = null, sawPython = false;
for (const c of PY_CANDIDATES) {
  const r = spawnSync(c, ['-m', 'yt_dlp', '--version'], { encoding: 'utf8', timeout: 30000 });
  if (r.error) continue;
  sawPython = true;
  if (r.status === 0) { PY = c; break; }
}
if (!PY) {
  console.error(sawPython
    ? '[需要] 有 Python 但缺 yt-dlp 模組。請安裝：pip install -U yt-dlp（Mac/Linux 用 pip3 install -U yt-dlp）。'
    : `[需要] 找不到 Python（試過 ${PY_CANDIDATES.join(' / ')}）。請先安裝 Python 並確認在 PATH。`);
  process.exit(2);
}
function ytdlp(args) { return spawnSync(PY, ['-m', 'yt_dlp', ...args], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: DL_TIMEOUT }); }

// 擋掉指向本機/內網的 URL：惡意課程頁可能在請求裡塞 loopback/私網 m3u8，讓 yt-dlp 去打使用者內網服務。
// 這是防禦性檢查（純主機名比對，不做 DNS 解析）；正常課程的 CDN 都是公網網域，不受影響。
function isBlockedHost(u) {
  let h;
  try { h = new URL(u).hostname.toLowerCase(); } catch (_) { return false; }
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const ip = h.replace(/^\[|\]$/g, '');           // 去掉 IPv6 方括號
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;       // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a >= 224) return true;                      // multicast/reserved
  }
  return false;
}

// yt-dlp 用 %(ext)s 讓它自己決定副檔名（webm/m4a/opus…），這裡照 idx 前綴找實際檔
function findAudio(idx) {
  try {
    return fs.readdirSync(AUD)
      .filter(f => f.startsWith(idx + '.') && !f.endsWith('.json'))
      .map(f => path.join(AUD, f))
      .find(f => { try { return fs.statSync(f).size > 20000; } catch (_) { return false; } }) || '';
  } catch (_) { return ''; }
}

const out = [];
items.forEach((it, i) => {
  const idx = String(i + 1).padStart(3, '0');
  const existing = findAudio(idx);
  const rec = { idx, title: it.title, host: it.host, url: it.url, audio: existing ? path.basename(existing) : '', status: '' };
  if (existing) { rec.status = 'skip'; out.push(rec); console.log(`[${idx}] skip ${(it.title || '').slice(0, 34)}`); return; }
  if (isBlockedHost(it.downloadUrl)) {
    rec.status = 'blocked(internal host)';
    out.push(rec);
    fs.writeFileSync(path.join(AUD, 'manifest.json'), JSON.stringify(out, null, 1), 'utf8');
    console.log(`[${idx}] ${(it.host || '').padEnd(10)} blocked(internal)  ${(it.title || '').slice(0, 32)}`);
    return;
  }
  // referer 對 vimeo / vimeo-external(HLS) / Mux / Teachify 等 domain-private 串流都可能必要 → 有就帶
  const args = ['-f', 'bestaudio/best', '--no-playlist', '--no-part', '--socket-timeout', '30', '--retries', '3', '--fragment-retries', '10'];
  if (it.referer) args.push('--referer', it.referer);
  args.push('-o', path.join(AUD, idx + '.%(ext)s'), it.downloadUrl);
  const r = ytdlp(args);
  let got = findAudio(idx);
  // 成功＝yt-dlp 真的乾淨結束(status 0) 且產出檔案。只看檔案大小會把「逾時/中斷/簽章過期」寫到一半的殘檔當成功，
  // 下次執行又被 findAudio 當成已存在而 skip、永不重抓 → 靜默產出不完整逐字稿。
  const ok = !!got && !!r && r.status === 0;
  if (!ok) {
    // 刪掉這個 idx 的所有殘檔（含未達門檻的小檔），確保下次執行會重新下載而非 skip
    try { fs.readdirSync(AUD).filter(f => f.startsWith(idx + '.') && !f.endsWith('.json'))
      .forEach(f => { try { fs.unlinkSync(path.join(AUD, f)); } catch (_) {} }); } catch (_) {}
    got = '';
  }
  rec.audio = ok ? path.basename(got) : '';
  rec.status = ok ? 'ok' : (r && r.error ? ('fail(' + (r.error.code === 'ETIMEDOUT' ? 'timeout' : r.error.code) + ')') : ('fail rc=' + (r ? r.status : '?')));
  if (!ok && r) rec.err = (r.stderr || '').slice(-200);
  out.push(rec);
  fs.writeFileSync(path.join(AUD, 'manifest.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(`[${idx}] ${(it.host || '').padEnd(10)} ${rec.status.padEnd(12)} ${(it.title || '').slice(0, 32)}`);
});
const ok = out.filter(x => x.status === 'ok' || x.status === 'skip').length;
const failed = out.filter(x => x.status !== 'ok' && x.status !== 'skip');
console.log(`\nDONE: ${ok}/${out.length} → ${AUD}`);
if (failed.length) {
  console.log(`⚠️ ${failed.length} 項失敗：`); failed.forEach(f => console.log(`   [${f.idx}] ${f.status}  ${(f.title || '').slice(0, 40)}`));
  process.exit(1);  // 非零離開碼：讓上層 agent 知道有單元沒下載到，別直接往下 render 出殘缺筆記
}
