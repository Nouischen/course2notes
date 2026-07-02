# 課程一鍵變筆記（工作名 Course2Notes）— MVP 藍圖與模組拆解

> 開源 Claude Code 技能包：把「買了看不完的線上課程」一鍵變成漂亮筆記。
> 使用者在自己的 Claude Code、用自己的算力跑；輸出自成一檔的漂亮 HTML；桌機用；匿名回報用量到小後台。
> 版本：v0 藍圖（2026-07-01）。作者：陳昱傑院長 × Claude。

---

## 1. 核心信念（為什麼這樣設計）
- **魔法是「會臨場應變的 agent」，不是固定腳本。** 每個平台結構都不同（LearnDash＋Vimeo、Teachify＋Mux、SoundCloud…），固定爬蟲碰到新平台就壞；給 agent 一套 playbook 讓它自己偵察、自己寫下載碼，才通用。
- **產品＝技能包（playbook），不是網站程式。** 網站只是門面＋精靈，不是引擎。
- **使用者自付算力**（自己的 Claude Code 訂閱＋本機 whisper 或自己的 API key）→ 作者零算力成本。
- **輸出漂亮 HTML，不綁 Notion。** 單一 HTML 檔＝跟 Notion 一樣漂亮、零帳號、任何瀏覽器可開、可印 PDF。**附帶好處：拿掉 Notion 就拿掉了我們踩過的所有「分批 append 亂碼」的雷。**
- **只做桌機**（需要登入中的瀏覽器 CDP）。
- **匿名、透明、只收計數**的用量回報，保護品牌。

## 2. 一張圖
```
使用者的 Claude Code（本地）
  └─ /course2notes <課程網址>
       1 偵察 Recon   → 認出平台結構＋影片/音訊掛哪
       2 抓清單 Harvest → 列舉所有單元＋媒體來源（產 manifest）
       3 下載 Download  → yt-dlp 抓 audio-only（Vimeo referer／SoundCloud token／HLS／YouTube）
       4 轉錄 Transcribe → 本機 faster-whisper（免費，需GPU）｜或 OpenAI Whisper API（付費，免GPU，音檔上傳 OpenAI）
       5 做筆記 Notes   → 子代理 fan-out，逐單元結構化筆記（修簡繁/術語，抓框架）
       6 產出 Render    → 一份漂亮 self-contained HTML（目錄＋分節＋可折疊＋可印）
       7 回報 Telemetry → POST 匿名事件
                              │
                              ▼
            Cloudflare Workers + D1（小後台）
                              │
                              ▼
            /admin 儀表板：總用戶、總筆記、每人幾份、平台分布、時間趨勢
```

## 3. 模組拆解（含「可沿用什麼」與工作量）
| # | 模組 | 做什麼 | 沿用來源 | 工作量 |
|---|---|---|---|---|
| M1 | **Skill 定義** `SKILL.md`＋`/course2notes` 指令 | 把 playbook 寫成 Claude Code 技能：何時觸發、七步流程、遇不同平台如何自己偵察 | 新做（但邏輯＝昨天 doctorally 的做法白紙化） | 中 |
| M2 | **偵察 Recon** `recon.js` | CDP 連已登入 Chrome、載入課程頁、判斷結構（課→章→單元）與媒體 host | 改寫 `doctorally-tools/recon*.js` | 小 |
| M3 | **抓清單 Harvest** `harvest.js` | 列舉單元＋攔 `player.vimeo/soundcloud/youtube` 抓媒體ID，產 manifest，標下架 | 改寫 `doctorally-tools/harvest.js`（已多來源） | 小-中 |
| M4 | **下載 Download** `download.js` | yt-dlp 抓 audio-only，多 host（Vimeo referer／SC token／HLS／YT） | **幾乎直接沿用** `doctorally-tools/download.js` | 極小 |
| M5 | **轉錄 Transcribe** `transcribe.py` | faster-whisper large-v3（本機）＋**API 選項**（OpenAI Whisper，音檔上傳 OpenAI）給無 GPU 者 | 沿用 `doctorally-tools/transcribe.py`＋加 API 分支 | 小 |
| M6 | **做筆記 Notes**（prompt 模板） | 逐單元筆記規格（修簡繁＋依脈絡修 ASR＋抓框架＋可執行要點） | 昨天已驗證好用的筆記 agent 指令，模板化 | 小 |
| M7 | **HTML 產生器** `render.js` | 讀 notes/ → 一份漂亮 self-contained HTML（內嵌 CSS、封面、目錄、分節、折疊、列印CSS） | **全新**（取代 Notion 建置） | 中（此案關鍵新件） |
| M8 | **回報端 Telemetry** `telemetry.js` | 首跑生成匿名 install_id＋同意提示；每次交件 POST 事件；可關 | 全新（很小） | 極小 |
| M9 | **分析後台** Workers＋D1 | `POST /event` 寫 D1；`/admin` 儀表板讀彙總；防濫用（限流/濾垃圾） | **沿用 SOP 網站那套** Cloudflare＋wrangler 技能 | 小-中 |
| M10 | **落地頁＋設定精靈** 靜態站 | 落地（品牌/賣點/相容平台清單/「只收這幾項」揭露）＋精靈（選平台/本機或API/語言/風格→吐出可貼指令） | 沿用 SOP／復健網站的靜態站做法 | 中 |

## 4. 遙測規格（保品牌的紅線）
**預設開啟**，但：
- 首次執行明確跳一句：**「本工具會回傳匿名使用計數（不含任何內容），可用 `COURSE2NOTES_TELEMETRY=off` 或設定檔關閉。」**
- README 白紙黑字列「只收這幾項」。

**只收（一律匿名）**：`install_id`(本機隨機UUID)、`event`(install｜notes_done)、`note_count`(本次幾份)、`platform_type`(如 vimeo/soundcloud/teachify — 有價值的產品訊號)、`tool_version`、`timestamp`。
**絕不收**：筆記內容、課程名稱、網址、任何個資。

D1 資料表（草）：`events(install_id, event, note_count, platform, version, ts)`；儀表板彙總：總用戶(distinct install_id)、總筆記(sum note_count)、每人分布、平台佔比、每日/每週趨勢。
**誠實限制**：開源＋匿名 → 數字是方向性參考（可被關閉/fork 繞過），但足以判斷值不值得做收費版。

## 5. MVP 範圍（最小但能給你真訊號）
先做「能動、能量」的最小版：
1. 把 doctorally 那套一般化成技能，**在「昨天的 doctorally」以外再跑通 1 個平台**（驗證適應力）— 首選 **知識衛星** 或 **Teachify/Hahow** 任一。
2. **M7 HTML 產生器**（本案最關鍵的新件，決定「漂不漂亮/砸不砸招牌」）。
3. **M8 遙測＋M9 最小後台**（只要能算「多少人、每人幾份」＋看得到）。
4. **M10 落地頁最小版**（賣點＋一行安裝指令＋「只收這幾項」揭露；精靈 v2 再做）。
5. 轉錄預設策略：偵測有無 GPU；有→本機 whisper，無→提示改用 API（自備 key）。

## 6. 分階段
- **Phase 1（MVP）**：M1–M8 打通＋M9 最小後台＋M10 落地頁 → 自己跑通 2 個平台 → 內測。
- **Phase 2**：設定精靈、支援更多平台、HTML 風格模板、i18n。
- **Phase 3（看用量再決定）**：收費版／代跑服務（那才需要「幫大家跑算力」的後台，另算帳）。

## 7. 決定（已拍板 / 待敲）
1. ✅ **散布方式＝GitHub repo＋一行安裝**（開源在 GitHub，貼一行指令把 skill 裝進 Claude Code；FB 分享一個連結）。
2. ✅ **轉錄預設＝偵測 GPU 自動切換**（有 GPU→本機 whisper 免費；無 GPU→提示改用 API 自備 key，約 US$0.006/分）。
3. ✅ **第二個先驗證平台＝知識衛星**（需院長在該站登入的瀏覽器供 CDP 偵察）。
4. ⏳ **產品名稱**：Course2Notes？中文名（課程煉金／看不完救星…）？— 待敲。
5. ⏳ **法務一句話**：定位「為已購買內容做個人筆記的工具，散布的是工具不是內容」＋免責。— 待敲。

## 8. 現成資產對照（少造輪子）
- `C:\Users\USER\doctorally-tools\`：recon/harvest/download/transcribe/scrape 全套 → M2–M6 的底。
- SOP 網站（Cloudflare Pages+Functions+KV，`sop-cms/`，wrangler 部署）→ M9 後台同一套技能，改用 D1。
- 復健網站／SOP 靜態站經驗 → M10 落地頁。
- 昨天驗證好用的筆記 agent 指令、HTML 排版直覺 → M6/M7。
