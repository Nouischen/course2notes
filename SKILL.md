---
name: course2notes
description: 把「買了看不完的線上課程」一鍵變成漂亮 HTML 筆記。當使用者想把某個線上課程平台（如 LearnDash、Teachify、知識衛星、Hahow、或影片掛在 Vimeo/SoundCloud/YouTube 的站）中「已購買」的課程，轉成可閱讀的結構化筆記時使用。觸發語：「幫我把這門課做成筆記／這個課程網址整理成筆記／課程看不完幫我做筆記／把 <課程網址> 變成筆記」。流程：偵察平台→抓單元清單→下載音訊→whisper 轉錄→子代理做筆記→產出 self-contained HTML。限桌機、需要一個「已登入該平台且開了除錯埠」的 Chrome。
---

# Course2Notes — 課程一鍵變筆記

把使用者「已購買、卻看不完」的線上課程，變成一份漂亮、可讀完、self-contained 的 HTML 筆記。

## 最重要的心法（先讀）
**每個平台的結構都不一樣，沒有固定腳本能通吃。你的價值是「臨場偵察、看懂這個平台、當場決定怎麼抓」。** 底下的腳本是「通用積木」，不是萬用爬蟲——你要用它們，但結構怎麼列舉、影片掛在哪，要靠你先偵察再決定，不要假設固定的 CSS 選擇器或網址格式。

## 前置：由「你（agent）」啟動除錯 Chrome，使用者只需登入
**全程盡量在對話裡完成，不要叫使用者去開 CMD、貼指令。** 安裝(git clone)、啟動瀏覽器這些 shell 動作都由你自己跑。使用者唯一要動手的是「登入課程平台」（為了安全，密碼只能他本人輸入；也不要用無頭瀏覽器登入，會觸發平台機器人偵測）。
0. **確保相依套件就緒（第一次跑才需要，之後可略）**：由你（agent）在對話裡自己跑，別叫使用者開 CMD。
   - Node：在**技能自己的資料夾**跑 `npm install`（裝 `playwright-core`；本技能只用它當 CDP 客戶端連使用者的 Chrome，不下載瀏覽器）。
   - Python：一律 `pip install -U yt-dlp`；轉錄若走本機 GPU 再 `pip install -U faster-whisper`，若走 `--api` 則 `pip install -U openai`（也可直接 `pip install -r requirements.txt`）。
   - ffmpeg／Node／Python／Chrome 屬系統層級，缺了就告訴使用者怎麼裝、別硬跑。
1. 必要時請使用者關掉既有 Chrome（同一設定檔不能被佔用）。
2. **你自己用 shell 啟動**一個帶除錯埠、獨立設定檔的 Chrome（依作業系統找 chrome 路徑），例如 Windows（PowerShell）：
   `Start-Process "<chrome.exe 路徑>" -ArgumentList '--remote-debugging-port=9222','--user-data-dir=<工作區>\chrome-profile','--no-first-run','<課程網址>'`
3. 確認 `http://localhost:9222/json/version` 有回應。
4. **請使用者在跳出的視窗登入課程平台、打開那門課，回你「好了」**。
之後所有偵察/抓取都用 `chromium.connectOverCDP('http://localhost:9222')` 連它、用既有 context（已登入）。

## 七步流程

### 1. 偵察（Recon）— 這步是靈魂，要臨場判斷
連上 CDP，載入使用者給的課程網址，觀察：
- **結構**：課程 → 章節 → 單元 的層級與網址型態（列出頁面上的連結、找出重複的路徑樣式）。注意有些平台「每個章節頁都會列出整門課大綱」→ 列舉時要按「屬於該章節」過濾去重（我們在 LearnDash 踩過）。
- **媒體來源**：打開一個真的單元頁，攔網路請求，看影片/音訊掛在哪。常見：`player.vimeo.com/video/<id>`（Vimeo 私人嵌入）、`w.soundcloud.com/player?...tracks/<id>...secret_token=`（SoundCloud 私人音軌）、`youtube.com/embed/<id>`、`.m3u8`（HLS）、直接 `<video src>`。**ID 常只出現在網路請求、不在原始 HTML** → 要用瀏覽器載入攔請求，不能只抓靜態 HTML。
- **純文字課**：若單元頁沒有任何影音、而是文章（如「百科」類），改走「爬文字」路徑（抓內文容器的 innerText），跳過下載與轉錄。
- **拿不到的**：標「已下架／DRM 加密」的單元記錄下來、告知使用者，不要卡住。
用 `recon.js <url>` 當起手式（它會 dump 連結樣式與偵測到的媒體 host），再據此決定列舉策略。

### 2. 抓清單（Harvest）
依偵察結果，列舉所有單元的網址與「每單元的媒體來源」，輸出 `manifest/<course>.json`（欄位：lesson、title、host、mediaId、downloadUrl、available）。
用 `sniff.js`：給它一批單元網址，它逐一用瀏覽器載入、攔 vimeo/soundcloud/youtube/hls，回填 host 與可下載 URL。判斷「沒有任何媒體請求＝已下架或純文字」。

### 3. 下載（Download）
`download.js <course>`：讀 manifest，對每個可下載項用 yt-dlp 抓 **audio-only**（省時省空間）。各 host 眉角：
- **Vimeo 私人嵌入**：一定要帶 `--referer https://<平台網域>/`（過網域驗證），否則 403。
- **SoundCloud 私人音軌**：用 `api.soundcloud.com/tracks/<id>?secret_token=s-xxx`。
- HLS/YouTube：yt-dlp 直接支援。
- 檔名一律用 ASCII 序號（`001.mp4`…），中文標題另存 manifest，避免編碼問題。

### 4. 轉錄（Transcribe）
`python transcribe.py <audio_dir> <transcript_dir> [--api]`：**自動偵測 GPU**——有 NVIDIA GPU → 本機 faster-whisper large-v3（免費、音檔不離開電腦）；無 GPU → 提示使用者改用 `--api`（需自備 `OPENAI_API_KEY`），並告知每分鐘成本。**提醒使用者：`--api` 模式會把音檔上傳給 OpenAI 轉錄**（作者端收不到，但音檔確實會離開本機到 OpenAI）。
注意：中文輸出常「簡繁混雜＋術語誤聽」，這在下一步筆記階段修（一律輸出繁體、依上下文修 ASR 錯字）。

### 5. 做筆記（Notes）— 子代理 fan-out
對每個單元的逐字稿/文章，派子代理產出結構化筆記（可平行、不吃 GPU）。每篇規格：
- 一律**繁體中文**；依脈絡修正明顯 ASR 錯字；**不杜撰**數字或情節，判讀不出就標「（口述不清）」。
- 結構：`# 單元標題` → `## 本單元重點`(3–5條) → `## 內容筆記`(完整保留框架/步驟/例子/數字/話術) → `## 可執行要點`。
- 深度＝「取代看完影片」，不是空泛大綱。
- **表格用 GFM pipe 格式**（`| 欄 | 欄 |` 加 `|---|---|` 分隔列），不要用 HTML `<table>`——HTML 產生器 render.js 只認 pipe 表格。
- 大課（幾十單元）按章節分給多個子代理，各寫各的檔到 `notes/<course>/NNN_note.md`。

### 6. 產出 HTML（Render）
`node render.js <notes_dir> <output.html> "<標題>" [語言]`：把 notes/ 組成一份 self-contained 漂亮 HTML（內嵌 CSS/JS、左側課程導覽、可跳轉、即時搜尋、暖色引言 callout、表格、可列印）。主色可改（品牌色）。**不綁 Notion**——這是預設交付格式，零帳號、任何瀏覽器可開。

### 7. 回報（Telemetry）
跑完呼叫 `node telemetry.js notes_done <筆記數> <媒體類別>`（見 README 揭露）。首次執行會顯示**告知**（預設開、可關），非需勾選的同意。只回傳匿名計數，絕不含內容／網址／課名。**`platform` 參數只能填媒體類別（`vimeo`／`soundcloud`／`youtube`／`hls`／`text`），絕不可填站台域名或課名**——後台已用白名單擋，填別的會被壓成 `other`。

## 已驗證平台樣式（可直接參考）
- **doctorally（LearnDash）**：課→lessons→topics；影片 `player.vimeo.com/video/<id>`（私人嵌入）＋SoundCloud 私人音軌；純文字課（百科）抓 `.ld-tabs-content`。
- **知識衛星 sat.cool**：`/member/learning/course` 列出 `/classroom/<id>`；影片是 **Vimeo external HLS** `player.vimeo.com/external/<id>.m3u8?s=<簽章>&oauth2_token_id=<id>`，segments 走 `vod-adaptive-ak.vimeocdn.com`，有獨立音軌、無 DRM；下載帶 `--referer https://sat.cool/` 即可。**注意：這種簽章 m3u8 有時效（URL 內含 exp）**→ 該單元的 sniff 與 download 要接近時間做，或下載失敗就重新 sniff 拿新簽章 URL。
- **Teachify 類自架平台（如 kim.com.tw 創業大課）**：影片走「自架 HLS」，播放器/CDN 常見 `teachifycdn`、`loopix`、或 **Mux（`stream.mux.com` 簽名 `.m3u8`）**。單元頁載入時攔 `.m3u8` 拿到簽名串流，帶「平台網域 referer」用 yt-dlp 抓 audio-only。（此樣式在 Kim 創業大課實際抽取成功；簽名串流同樣有時效。）
- **Hahow hahow.in（試看觀察，非付費內容驗證）**：課程 `/courses/<id>`；影片用 **JWPlayer**——manifest `cdn.jwplayer.com/manifests/<id>.m3u8`、簽名 MP4 `cdn.jwplayer.com/videos/<id>.mp4?exp=&sig=`、segments 走 `videos-cloudfront-*.jwpsrv.com`；JW media id 形如 `mbuK7Azj`。yt-dlp 支援 JWPlayer，簽名 URL 有時效。**注意：以上是免費試看觀察到的；付費課程可能加 DRM（JWPlayer 可配 Widevine），需實際擁課才能確認付費內容能否下載。**

> 判讀原則：偵察時只要在網路請求看到 `cdn.jwplayer.com` / `player.vimeo.com` / `stream.mux.com` / `soundcloud` / `.m3u8` 等，就對照上面樣式決定下載法；沒看到 `widevine`/`.key`/`license`/EME 就多半是可抓的明文串流。

## 常見雷（前人踩過）
- 別 blanket kill node/python（會殺到別的工作）。
- 列舉時小心「每章節頁都列全課大綱」造成重複 → 按所屬章節過濾。
- 中文路徑在 shell 會亂碼 → node/python 走英文路徑、用序號檔名。
- 子代理偶發啟動即死（0 tool use）→ 檢查產出、失敗就重派。
- 轉錄是 GPU 單隊列，別同時跑兩個 whisper（會 OOM）。

## 腳本清單與呼叫簽名（本技能夾內）
- `node recon.js <課程網址> [cdp]` — 偵察，dump 連結樣式與偵測到的媒體 host（cdp 預設 `http://localhost:9222`）
- `node sniff.js <urls.txt> <out.json> [origin] [cdp]` — 逐一用瀏覽器載入單元頁、攔 vimeo/soundcloud/youtube/hls，回填 host 與可下載 URL
- `node download.js <manifest.json> <audio_dir>` — 讀 manifest，對每個可下載項用 yt-dlp 抓 audio-only
- `python transcribe.py <audio_dir> <transcript_dir> [--api]` — 有 GPU→本機 faster-whisper；無 GPU 加 `--api` 走 OpenAI（**音檔會上傳 OpenAI**）
- `node render.js <notes_dir> <out.html> "<標題>" [語言]` — 產 self-contained HTML
- `node telemetry.js <event> [noteCount] [platform]` — 匿名回報；**`platform` 只能填媒體類別（vimeo/soundcloud/youtube/hls/text），絕不可填站台域名或課名**

設定見 `config.example.json`。
