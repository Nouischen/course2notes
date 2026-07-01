# Course2Notes 課程一鍵變筆記

把你**已經買、卻看不完**的線上課程，一鍵變成一份漂亮、能讀完的 HTML 筆記。

在你自己的 **Claude Code** 裡跑、用你自己的算力，**作者收不到任何你的內容**。輸出是一份 self-contained 的 HTML（不需要 Notion、不需要註冊、任何瀏覽器打開就看，還能列印成 PDF）。

> 這不是一套「固定爬蟲」，而是一份「讓你的 Claude Code 臨場看懂每個平台、自己想辦法抓」的技能包。所以它能適應很多平台，但**不保證每個平台都成功**（有硬 DRM 加密的影片抓不到）。

## 支援情況
- ✅ 影片掛 **Vimeo（私人嵌入）／SoundCloud（私人音軌）／YouTube／HLS(.m3u8)** 的平台（如 LearnDash 類、Teachify 類、知識衛星…）
- ✅ 純文字／文章型課程（直接萃取內文）
- ❌ 硬 DRM 加密串流（部分大型平台）— 影片下載不了

## 你需要
- **桌上型電腦**（Windows / macOS / Linux）
- **Claude Code**（本技能在它底下跑）
- **Node.js、Python、ffmpeg、yt-dlp**（`pip install yt-dlp`）
- 轉逐字稿：**有 NVIDIA GPU** → 自動用本機 faster-whisper（免費）；**沒有 GPU** → 需自備 `OPENAI_API_KEY`（約 US$0.006/分鐘）
- 一個能登入你課程平台的瀏覽器帳號（你本來就有）

## 安裝（一行）
```bash
git clone https://github.com/<your>/course2notes ~/.claude/skills/course2notes
```
（或依你的 Claude Code 技能安裝方式放入 skills 目錄。）

## 使用
1. 依提示開一個「帶除錯埠、已登入」的 Chrome，登入你的課程平台。
2. 在 Claude Code 說：**「用 course2notes 把 <課程網址> 做成筆記」**。
3. 它會偵察平台 → 抓清單 → 下載音訊 → 轉逐字稿 → 做筆記 → 產出 `course-notes.html`。
4. 雙擊打開那個 HTML 就是你的筆記。

---

## 📊 匿名使用統計（請讀）
本工具**預設會回傳一筆「匿名使用計數」**，幫助我們判斷有多少人在用、值不值得繼續投入。

**只收這幾項（全部匿名、無法對應到你）：**
- 一組本機隨機產生的匿名安裝碼（不含任何個人資訊）
- 事件類型（安裝 / 完成一份筆記）
- 這次產生了幾份筆記
- 平台類型（例如 vimeo / soundcloud / youtube / text）
- 工具版本、時間戳

**絕對不會收：** 你的筆記內容、課程名稱、課程網址、任何個人資料、任何檔案。

**怎麼關掉：** 設定環境變數 `COURSE2NOTES_TELEMETRY=off`，或在 `config.json` 設 `"telemetry": false`。程式碼開源，你可以自己檢查 `telemetry.js` 到底送了什麼。

---

## ⚖️ 使用聲明
本工具僅供你**為自己已合法購買、且有權存取**的課程內容，製作**個人學習筆記**之用。散布的是「工具」，不是任何課程內容。請遵守你所在平台的服務條款與著作權法；請勿散布、轉售或公開你下載或產生的內容。使用本工具的行為與後果由使用者自行負責。

## 作者
陳昱傑醫師（Dr. Chen）

## 授權
開源（建議 MIT）。歡迎 fork、改造、貢獻更多平台的偵察樣式。
