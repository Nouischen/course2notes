# Course2Notes 分析後台（Cloudflare Worker + D1）

收 `telemetry.js` 送來的匿名事件，提供 `/admin` 儀表板看：總用戶、總筆記、每人幾份、平台分布、每日趨勢。
只存匿名計數，不含任何內容/個資。

## 部署（跟你 SOP 網站同一套 wrangler）
```bash
cd analytics

# 1) 建 D1 資料庫（複製輸出的 database_id 貼進 wrangler.toml）
wrangler d1 create course2notes

# 2) 建表（本地＋雲端各跑一次；雲端加 --remote）
wrangler d1 execute course2notes --file=schema.sql --remote

# 3) 設定後台密碼（Basic Auth 用；帳號預設 admin，可另設 ADMIN_USER）
wrangler secret put ADMIN_KEY
# （選用）wrangler secret put ADMIN_USER

# 4) 部署
wrangler deploy
```
部署完會得到一個網址，例如 `https://course2notes-analytics.<你的帳號>.workers.dev`。

## 接上工具
把上面網址填進 `../config.example.json`（複製成 `config.json`）：
```json
"telemetryEndpoint": "https://course2notes-analytics.<你的帳號>.workers.dev/event"
```

## 看後台
瀏覽器開 `https://course2notes-analytics.<你的帳號>.workers.dev/admin`
→ 跳出登入，輸入帳號 `admin`（或你設的 ADMIN_USER）＋ 你設的 ADMIN_KEY。

## API
- `POST /event`：body = `{install_id,event,note_count,platform,version,ts}`。嚴格驗證，格式不符直接丟棄（擋開源端點被亂灌）。
- `GET /admin`：Basic Auth 後回傳 HTML 儀表板。

## 防濫用
端點在開源碼裡是公開的，已做：欄位嚴格驗證＋長度/數值上限＋只收白名單事件。若日後被灌水，可在 Cloudflare 後台加 Rate Limiting 規則（依 IP 限流）。

## 本地測試
```bash
wrangler dev
# 另開終端：
curl -X POST http://localhost:8787/event -H "Content-Type: application/json" \
  -d '{"install_id":"c2n_abc123def4567890","event":"notes_done","note_count":8,"platform":"vimeo","version":"0.1.0","ts":1735660800}'
# 開 http://localhost:8787/admin 看
```
