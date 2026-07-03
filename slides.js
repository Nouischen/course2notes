// 從單元影片抽「候選投影片」給子代理挑選（不是每格都要，是給多模態代理看的候選池）。
// 做法：ffmpeg 場景偵測（畫面變化夠大才抽）→ 縮到 <=960 寬的 JPG → 記每張的時間戳。
// 「哪些值得放進筆記」由子代理判斷（只留有非文字資訊的圖：圖表/示意/軟體畫面/照片）。
// 用法：node slides.js <video檔> <out_dir> [scene_threshold=0.4] [max=40]
// 相依：只需 ffmpeg（本技能本來就要）。零額外套件。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VIDEO = process.argv[2], OUT = process.argv[3];
const THRESH = parseFloat(process.argv[4]) || parseFloat(process.env.COURSE2NOTES_SLIDE_THRESHOLD) || 0.4;
const MAX = Math.max(2, parseInt(process.argv[5], 10) || parseInt(process.env.COURSE2NOTES_SLIDE_MAX, 10) || 40); // 下限 2：等距抽樣要除以 MAX-1，=1 會 NaN 全刪
if (!VIDEO || !OUT) { console.error('usage: node slides.js <video> <out_dir> [scene_threshold=0.4] [max=40]'); process.exit(1); }
if (!fs.existsSync(VIDEO)) { console.error(`[ERR] 找不到影片：${VIDEO}`); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

function ff(args) { return spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 28 }); }
// ffmpeg 在不在？
if (ff(['-version']).status !== 0) { console.error('[需要] 找不到 ffmpeg，請先安裝（可請 Claude Code 幫你裝）。'); process.exit(2); }

// 場景偵測 + showinfo（拿時間戳）+ 縮圖。-vsync vfr 只輸出被 select 選中的格。
const pat = path.join(OUT, '%03d.jpg');
const vf = `select='gt(scene\\,${THRESH})',showinfo,scale='min(960,iw)':-2`;
const r = ff(['-hide_banner', '-i', VIDEO, '-vf', vf, '-vsync', 'vfr', '-q:v', '5', '-y', pat]);
if (r.status !== 0 && !fs.readdirSync(OUT).some(f => /^\d+\.jpg$/.test(f))) {
  console.error('[ERR] ffmpeg 抽圖失敗：\n' + (r.stderr || '').slice(-500)); process.exit(3);
}

// 從 showinfo 解析每張的 pts_time（依序對應 001.jpg, 002.jpg…）
const times = [];
const re = /pts_time:([0-9.]+)/g; let m;
while ((m = re.exec(r.stderr || '')) !== null) times.push(parseFloat(m[1]));

let frames = fs.readdirSync(OUT).filter(f => /^\d+\.jpg$/.test(f)).sort();

// 超過上限就等距抽樣（保留頭尾），避免候選池過大
if (frames.length > MAX) {
  const keep = new Set();
  for (let k = 0; k < MAX; k++) keep.add(Math.round(k * (frames.length - 1) / (MAX - 1)));
  frames.forEach((f, idx) => { if (!keep.has(idx)) { try { fs.unlinkSync(path.join(OUT, f)); } catch (_) {} } });
  frames = fs.readdirSync(OUT).filter(f => /^\d+\.jpg$/.test(f)).sort();
}

function ts(s) { if (s == null) return ''; const t = Math.floor(s); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
const manifest = frames.map((f, idx) => {
  const origIdx = parseInt(f, 10) - 1;          // 001.jpg → 第 0 張
  const t = times[origIdx];
  return { file: f, t: t != null ? +t.toFixed(2) : null, at: ts(t) };
});
fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(manifest, null, 1), 'utf8');

console.log(`[slides] 候選投影片 ${frames.length} 張（scene>${THRESH}）→ ${OUT}`);
console.log('  下一步：讓子代理看這些候選圖，只把「有非文字資訊」的挑進筆記，用 ![說明](相對路徑) 引用；純文字投影片略過。');
if (frames.length === 0) console.log('  （沒偵測到明顯畫面切換——多半是純講者/無投影片的課，跳過嵌圖即可。）');
