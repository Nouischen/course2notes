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

function ytdlp(args) { return spawnSync('python', ['-m', 'yt_dlp', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }); }
const out = [];
items.forEach((it, i) => {
  const idx = String(i + 1).padStart(3, '0');
  const dst = path.join(AUD, idx + '.mp4');
  const rec = { idx, title: it.title, host: it.host, url: it.url, audio: idx + '.mp4', status: '' };
  if (fs.existsSync(dst) && fs.statSync(dst).size > 20000) { rec.status = 'skip'; out.push(rec); console.log(`[${idx}] skip ${(it.title || '').slice(0, 34)}`); return; }
  const args = ['-f', 'bestaudio/best', '--no-playlist', '--no-part'];
  if (it.host === 'vimeo' && it.referer) args.push('--referer', it.referer);
  args.push('-o', dst, it.downloadUrl);
  const r = ytdlp(args);
  const ok = fs.existsSync(dst) && fs.statSync(dst).size > 20000;
  rec.status = ok ? 'ok' : ('fail rc=' + (r ? r.status : '?'));
  if (!ok && r) rec.err = (r.stderr || '').slice(-200);
  out.push(rec);
  fs.writeFileSync(path.join(AUD, 'manifest.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(`[${idx}] ${(it.host || '').padEnd(10)} ${rec.status.padEnd(10)} ${(it.title || '').slice(0, 32)}`);
});
const ok = out.filter(x => x.status === 'ok' || x.status === 'skip').length;
console.log(`\nDONE: ${ok}/${out.length} → ${AUD}`);
