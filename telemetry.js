// 匿名使用計數回報。只送：匿名安裝碼、事件、筆記數、平台類型、版本、時間。
// 絕不送內容/課名/網址/個資。可用 COURSE2NOTES_TELEMETRY=off 或 config.telemetry=false 關閉。
// 用法：node telemetry.js <event> [noteCount] [platform]
//   event = install | notes_done
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const VERSION = '0.1.0';
const HOME = path.join(os.homedir(), '.course2notes');
const IDFILE = path.join(HOME, 'install_id');
const CONSENT = path.join(HOME, 'consent_shown');

function loadConfig() {
  for (const p of ['config.json', 'config.example.json']) {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8')); } catch (_) {}
  }
  return {};
}
function disabled(cfg) {
  if ((process.env.COURSE2NOTES_TELEMETRY || '').toLowerCase() === 'off') return true;
  if (cfg.telemetry === false) return true;
  return false;
}
// 隨機匿名安裝碼（非硬體識別、無個資）
function installId() {
  fs.mkdirSync(HOME, { recursive: true });
  try { const id = fs.readFileSync(IDFILE, 'utf8').trim(); if (id) return id; } catch (_) {}
  const id = 'c2n_' + Array.from({ length: 16 }, () => 'abcdef0123456789'[Math.floor(Math.random() * 16)]).join('');
  fs.writeFileSync(IDFILE, id);
  return id;
}
function showConsentOnce() {
  if (fs.existsSync(CONSENT)) return;
  console.log('\nℹ️  Course2Notes 會回傳「匿名使用計數」（只有：安裝碼/事件/筆記數/平台類型/版本/時間，不含任何內容或個資）。');
  console.log('   關閉方式：設定環境變數 COURSE2NOTES_TELEMETRY=off，或在 config.json 設 "telemetry": false。\n');
  try { fs.writeFileSync(CONSENT, '1'); } catch (_) {}
}

function report(event, noteCount, platform) {
  const cfg = loadConfig();
  showConsentOnce();
  if (disabled(cfg)) { console.log('[telemetry] 已關閉，未回報。'); return; }
  const ep = cfg.telemetryEndpoint;
  if (!ep || /REPLACE-ME/.test(ep)) { console.log('[telemetry] 未設定 endpoint，略過。'); return; }
  const payload = JSON.stringify({
    install_id: installId(),
    event: event || 'unknown',
    note_count: Number(noteCount) || 0,
    platform: platform || '',
    version: VERSION,
    ts: Math.floor(Date.now() / 1000)
  });
  try {
    const u = new URL(ep);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 4000 },
      res => { res.on('data', () => {}); res.on('end', () => {}); });
    req.on('error', () => {}); req.on('timeout', () => req.destroy());
    req.write(payload); req.end();
  } catch (_) { /* 回報失敗絕不影響主流程 */ }
}

if (require.main === module) {
  report(process.argv[2], process.argv[3], process.argv[4]);
}
module.exports = { report };
