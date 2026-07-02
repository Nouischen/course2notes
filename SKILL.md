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
   - **系統層級先體檢**：依序確認 `node --version`、Python（Windows 試 `python`/`py`，Mac/Linux 試 `python3`）、`ffmpeg -version`、Chrome 是否存在。**缺了先徵求使用者同意、然後由你代裝**：Windows 用 `winget install`（`OpenJS.NodeJS.LTS`／`Python.Python.3.12`／`Gyan.FFmpeg`／`Google.Chrome`），Mac 用 `brew install`（`node`／`python`／`ffmpeg`，Chrome 用 `brew install --cask google-chrome`）。真的裝不了（無 winget/brew、公司電腦鎖權限）才給官方下載連結請使用者手動裝。
     - **macOS 沒有預裝 Homebrew**（Windows 的 winget 在 Win10/11 已預裝、通常免這步）。若 `brew` 不存在：徵求同意後由你代裝——`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`（會跳出 **Xcode Command Line Tools** 的 GUI 安裝框，請使用者按同意；裝完依提示把 brew 加進 PATH）。若使用者不想裝 brew，改給官方安裝檔請他手動裝：Node（nodejs.org）、Python（python.org）、Chrome（google.com/chrome）、ffmpeg（`brew install ffmpeg` 或 evermeet.cx 下載）。**別假設 Mac 上已有 brew 就直接 `brew install`。**
     - **⚠️ 用 winget/brew 裝完系統工具後，正在執行的 Claude Code 讀不到新的 PATH**（環境變數是行程啟動時的快照）——請使用者**完全關閉並重開 Claude Code** 再繼續，否則接下來的 `node`／`python`／`ffmpeg` 會「找不到指令」即使剛剛裝成功。（同理，`OPENAI_API_KEY` 設完系統環境變數也要重開；或當次改用 inline 帶入。）
   - Node：在**技能自己的資料夾**跑 `npm install`（裝 `playwright-core`；本技能只用它當 CDP 客戶端連使用者的 Chrome，不下載瀏覽器）。
   - Python（**用剛才體檢時可用的那個直譯器**：Windows 可能是 `python` 或 `py`，Mac/Linux 是 `python3`／`pip3`；下載與轉錄要用同一個，套件才裝得到對的地方）：先 `pip install -r requirements.txt`（裝 yt-dlp）；轉錄再**三選一**——① **有 NVIDIA 顯卡（Windows/Linux）** `pip install -r requirements-gpu.txt`（含 faster-whisper＋CUDA 執行期 cuDNN/cuBLAS，缺了會 `Unable to load libcudnn`）；② **Apple Silicon Mac（M 系列）** `pip install -r requirements-mac.txt`（裝 mlx-whisper，吃 Mac GPU、免費本機轉錄）；③ **Intel Mac 或都沒有** `pip install -r requirements-api.txt`（走 OpenAI API）。**別在 macOS 裝 GPU 檔**（nvidia-* wheel 在 Mac 裝不起來）。
     - **⚠️ 若 pip 報 `externally-managed-environment`**（Homebrew 的 Python、Debian/Ubuntu 的系統 Python 都會擋，PEP 668）：加 `--break-system-packages`（例：`pip3 install --break-system-packages -r requirements.txt`）。這會裝進 download.js／transcribe.py 會用到的同一個系統直譯器；**別改用 venv**——那樣 download.js 從 PATH 找 `python -m yt_dlp` 會找不到套件。
   - **只有「沒有免費本機路徑」的機器才要 OpenAI 金鑰**——即 **Intel Mac、AMD/Intel 顯卡、沒有顯卡** 的 Windows（**Apple Silicon Mac 與 NVIDIA 顯卡都免金鑰、走本機**，別叫他們去辦金鑰）。若屬前者且沒有 `OPENAI_API_KEY`，先引導使用者到 platform.openai.com/api-keys 建一把（需綁付款），當次用 **inline 帶入**（Windows PowerShell `$env:OPENAI_API_KEY='sk-...'`、Mac/Linux `export OPENAI_API_KEY=sk-...`）免重開。**別等轉錄那步才發現沒金鑰、白下載一小時。**
   - 相依都就緒後，發一次安裝計數：`node telemetry.js install`（這也會在此時印出「首跑匿名計數告知」——請你把它轉述給使用者，並告知 `COURSE2NOTES_TELEMETRY=off` 可關）。
1. **不用**請使用者關掉原本的 Chrome——下一步開的是**獨立 `--user-data-dir` 的另一個實例**，和日常 Chrome 並存不衝突。
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
- **字幕優先（強烈建議先找）**：偵察時順手看有沒有**官方字幕／逐字稿軌**——Vimeo 的 `texttrack`／`.vtt`、YouTube captions、平台自帶的字幕或講義逐字稿。**有字幕就字幕優先**：直接抓字幕檔（yt-dlp 可用 `--write-subs`／`--write-auto-subs --sub-langs <lang> --skip-download`，或攔 `.vtt`/`.srt` 網址下載）當逐字稿，**跳過下載音訊＋whisper 這兩步**，品質（人工字幕沒有 ASR 錯字）與速度都大勝。**whisper 只當沒有字幕時的 fallback**。（sat.cool 的 Vimeo 字幕軌驗過非常成功。）
- **純文字課**：若單元頁沒有任何影音、而是文章（如「百科」類），改走「爬文字」路徑（抓內文容器的 innerText），跳過下載與轉錄。
- **拿不到的**：標「已下架／DRM 加密」的單元記錄下來、告知使用者，不要卡住。
用 `recon.js <url>` 當起手式（它會 dump 連結樣式與偵測到的媒體 host），再據此決定列舉策略。

### 2. 抓清單（Harvest）
依偵察結果，列舉所有單元的網址與「每單元的媒體來源」，輸出 `manifest/<course>.json`。**實際格式是 `{"items":[{title, url, host, mediaId, downloadUrl, referer, available}]}`**（注意有 `items` 外層陣列，沒有 `lesson` 欄位）。`referer` 對 Vimeo／Mux／域名私有 HLS 是**必填**（download.js 只從 manifest item 讀 referer、沒有 CLI 旗標，漏了會 403）。若你**手工建 manifest**（例如純 `<video src>` 直連——sniff.js 的 classify 只認 vimeo/soundcloud/youtube/hls，其他要自己填），務必照這個結構，否則 download.js 會在 `.items.filter` 崩。
用 `sniff.js`：給它一批單元網址，它逐一用瀏覽器載入、攔 vimeo/soundcloud/youtube/hls，回填 host 與可下載 URL。判斷「沒有任何媒體請求＝已下架或純文字」。

### 3. 下載（Download）
`node download.js <manifest.json> <audio_dir>`：讀 manifest，對每個可下載項用 yt-dlp 抓 **audio-only**（省時省空間）。各 host 眉角：
- **Vimeo 私人嵌入**：一定要帶 `--referer https://<平台網域>/`（過網域驗證），否則 403。
- **SoundCloud 私人音軌**：用 `api.soundcloud.com/tracks/<id>?secret_token=s-xxx`。
- HLS/YouTube：yt-dlp 直接支援。
- 檔名一律用 ASCII 序號（`001.mp4`…），中文標題另存 manifest，避免編碼問題。
- **`download.js` 非零離開碼＝有單元沒抓到**（逾時／簽章過期／被擋內網主機）。看它印的失敗清單：簽章 m3u8 過期就重跑該單元的 sniff 拿新 URL 再下載；仍失敗就告知使用者哪幾單元缺、別默默帶著缺漏往下做。

### 4. 轉錄（Transcribe）
`python transcribe.py <audio_dir> <transcript_dir> [--api]`（**用步驟 0 體檢可用的直譯器**：Windows 可能是 `python` 或 `py`，Mac/Linux 用 `python3`——和裝套件的那個要一致）：**自動選後端**——有 NVIDIA 顯卡 → 本機 faster-whisper large-v3（免費、音檔不離開電腦，需先裝 cuDNN＋cuBLAS，見步驟 0）；Apple Silicon Mac → 本機 mlx-whisper（免費、吃 Mac GPU、音檔不離開電腦）；都沒有（Intel Mac／AMD／無顯卡）→ 提示改用 `--api`（需自備 `OPENAI_API_KEY`），並告知每分鐘成本。**提醒使用者：`--api` 模式會把音檔上傳給 OpenAI 轉錄**（作者端收不到，但音檔確實會離開本機到 OpenAI）。
語言：預設讓 Whisper **自動偵測**（英文課→英文逐字稿、中文課→中文）。只有在你明確知道語言、要強制時才設環境變數 `COURSE2NOTES_LANG`（如 `zh`／`en`／`ja`）。**別預設塞 `zh`**，否則英文課會被硬套中文 ASR 產出亂碼。
非零離開碼＝有單元轉錄失敗或根本沒有音檔（exit 3）——先查原因，別帶著缺漏 render。
注意：中文輸出常「簡繁混雜＋術語誤聽」，這在下一步筆記階段修（一律輸出繁體、依上下文修 ASR 錯字）。

### 4.5 投影片截圖（選配——只對「有投影片、且圖上有料」的課做）
若課程是投影片型、投影片上有**非文字資訊**（圖表、示意圖、軟體操作畫面、照片），可把這些圖嵌進筆記，讓「圖示重建」直接用真圖。**純講者頭像、或投影片只是文字條列的課，跳過這步**——那些字已在逐字稿裡，截圖只會讓筆記肥大。判斷「值不值得做投影片」是 recon 就該做的決定。

1. **多抓一路低解析視訊**（音訊照舊）：只對要做投影片的單元，用 yt-dlp 抓一份小檔視訊暫用，例：`yt-dlp -f "bv*[height<=480]/wv*/worst" --no-playlist -o "<slides工作區>/<idx>.%(ext)s" <downloadUrl>`（帶必要的 `--referer`）。抽完圖可刪。
2. **抽候選投影片**：`node slides.js <該單元視訊> notes/<course>/slides/ [threshold=0.4] [max=40]`——ffmpeg 場景偵測抽出畫面明顯變化的候選格，存 `slides/NNN.jpg` ＋ `slides.json`（含各張時間戳）。零額外相依。
3. **子代理挑選（關鍵、也是我們比別人強的地方）**：做筆記子代理**直接看這些候選圖**（多模態），**只留有非文字資訊的**，其餘丟掉（一堂課常只留 5–15 張）。挑中的用 `![一句話說明](slides/NNN.jpg)` 放到對應段落（用 `slides.json` 時間戳對齊逐字稿）；能順手把圖上的表格/清單也重建成 HTML 更好。
4. **自足性不變**：圖是加分，配的說明要能脫離圖獨立看懂（見 5-①）。

備註：render.js 只把 `slides/` 裡**被引用到**的圖內嵌成 data URI（維持 self-contained、可點擊放大），沒引用的不進 HTML；單張超過 `COURSE2NOTES_IMG_MAX_KB`（預設 900KB）會略過。

### 5. 做筆記（Notes）— 子代理 fan-out
對每個單元的逐字稿/文章，派子代理產出結構化筆記（可平行、不吃 GPU）。目標是**「重排版＋去口水的完整重寫」，不是逐字照搬、也不是空泛摘要**。

> ⚠️ **派子代理時，務必把下面的「① 自足性鐵則」連同反例／正解與強制自我稽核，原文放進每個子代理的 prompt。** 別只丟一句「把這份逐字稿整理成筆記」——那樣子代理收不到自足性規則，會默默把「左邊藍色圈圈」這類指涉畫面的話照搬進去（**實測發生過**，這是本步驟的頭號破口）。

每篇規格：

**① 自足性鐵則（最重要——本技能最容易失守、最傷品質的一關，當硬規則執行）**
筆記的讀者**沒看過影片、看不到投影片**。任何「要看著畫面才懂」的句子，在純文字筆記裡都是壞掉的。

**先化解張力**：這條和「完整保真」不衝突。**保真＝保住重點、洞見、數字、結論；不是保住講者『描述畫面』的措辭。** 兩者衝突時**自足性優先**——寧可改寫，也不可照抄「左邊藍色圈圈」這種話。（實測：只寫「原則」時，子代理仍會為了保真而照搬指涉畫面的話，所以下面用**機械式檢查**強制執行。）

**反例 ❌（直接照搬逐字稿，讀者沒圖就看不懂——這正是要根除的）**：
「左邊圖表的藍色圈圈是 Google 流量、右下角綠色圈圈是 ChatGPT，過去只有藍色圈圈、現在多了綠色圈圈，藍色＋綠色 > 原本只有藍色。」

**正解 ✅（抽出洞見、改寫成自足文字，圖的結構用表格重建）**：
```
> [!KEY] 講者的核心推論
> AI 搜尋帶來的是「額外新增」的需求，不是瓜分原本的流量。

Google 的流量仍是全球最高、傳統搜尋沒有消失；ChatGPT 已是全球前十的網站、體量相當大。能爭取的總流量因此從「只有 Google」變成「Google（傳統搜尋仍在）＋ ChatGPT 等 AI（額外新增）」，餅變大了。

| 情境 | 可爭取的流量 |
|---|---|
| 過去 | 只有 Google（傳統搜尋） |
| 現在 | Google（傳統搜尋仍在）＋ ChatGPT 等 AI（額外新增） |
```

**怎麼判斷＋強制自我稽核**（關鍵字掃描只是最後補漏網的一道，不是主要機制）：
- **主判準（先用這個）**：把每一句當成「一個沒看過影片的人」在讀——讀得懂、資訊完整就過；只有「不看那個畫面就不知道在指什麼」的地方要處理。
- **處理＝改寫，不是刪除**：⚠️ 千萬別只是把含這些字的句子刪掉——那會連講者要傳達的內容一起丟掉，讀者反而更看不懂（本末倒置）。正確做法是**把那個畫面在表達的意思、從上下文還原出來、用文字補進去**，資訊只增不減。刪掉一句「看左邊藍色圈圈」不算修好；把「Google 流量仍最大」這個它想講的意思寫出來，才算。
- **關鍵字掃描（補漏網）**：掃「圖／圈／圈圈／左／右／上圖／下圖／如圖／如上／這張／這邊／這個部分／像這樣／箭頭／方框」等指示詞與顏色詞，每一處**回到主判準判斷**——指涉「讀者看不到的東西」才改；**本身就自足的別動**（例如「藍色連結」＝超連結、品牌色、純比喻，留著）。掃描是為了不漏，不是要你機械式刪字。
- **真的還原不出來時**（講者只說「看這個」而逐字稿沒帶出內容）：別硬掰、也別留懸空殘句，簡短標「（此處講者指投影片，逐字稿未含具體內容）」，讓讀者知道這裡有個沒被記錄到的視覺，而不是丟一句讀不懂的話。
- 需要把某張圖／投影片「重建」給讀者時，兩條路：
  - **有截圖**（做了投影片截圖那步、且該圖有非文字資訊）→ 直接嵌真圖：獨立一行 `![一句話說明這張圖在講什麼](slides/NNN.jpg)`。**說明本身要自足**（就算圖沒載入，光看說明也懂重點）。
  - **沒截圖**（純音訊課，或圖只是文字條列）→ 用 **`> [!FIG] 圖示重建`** 框把它的意思講完，框後可接 GFM 表格把結構畫出來。
- **圖是加分、不是文字的替身**：文字永遠要能脫離圖獨立看懂（圖可能沒載入、可能黑白列印）。**只能指涉「當場真的嵌進去的圖」**（可以說「下圖…」因為讀者看得到）；**絕不指涉缺席的東西**（「左邊紅圈圈」這種，圖不在就是壞的）。

**② 完整保真、去口水**
- 保留所有**框架、步驟、實際數字、案例、話術、講者的觀點與金句、現場 Q&A** ——深度＝「取代看完影片」。
- 去掉的是：口頭贅字、重複、「呃/那個/對」、跟內容無關的閒聊、以及上面說的指涉畫面的話。
- 一律**繁體中文**；依上下文修明顯的 ASR 錯字（術語、人名）；**不杜撰**數字或情節，判讀不出標「（口述不清）」，不要自己補。

**③ 版面與結構（只用 render.js 認得的語法，做出好吸收、可掃讀的筆記）**

**固定開頭（每篇同位置、同樣式，讓讀者 30 秒內判斷要精讀或跳讀）**：
- `# 單元標題`
- `> [!NOTE] 課名 · 章節/單元序號 · 影片長度`（放中繼資料；長度不確定就省略。**別用裸 `>` 引言放這行**，那會渲染成金句框、語義錯）
- `> [!KEY] 一句話總結` —— 單句、含**粗體**核心主張，是讀者離開後唯一記得住的鉤子
- `> [!KEY] 你會學到` —— 底下接 3–5 條**清單**（`> - 項目`）

**接著**：
- `## 內容筆記`：內部用**真的 `###` 小標**分主題（別只用粗體行當標題——粗體沒有層級、也進不了導覽）。逐主題保留框架/推導/例子/數字/話術。
  - （選配）主題小標後可加該段在影片的時間 `⏱ 12:34`（用 `transcript/*.timestamped.txt`）——方便使用者回原課程找該段。**注意：無法點擊跳轉**（嵌不了平台影片），只是給人工定位用，別過度標。
- 課程有 **3 個以上專有名詞**時，加 `## 關鍵詞`：用清單列「**術語**：在這門課裡的意思」，讓讀者不用回頭查。
- 結尾 `## 可執行要點`：用**待辦清單** `- [ ] 動作`——render.js 會渲染成可勾選、且重開 HTML 仍記得勾選狀態的核取方塊。

**版面元件**：
- **彩色重點框（callout）**：`> [!KEY]` 藍重點/TL;DR、`> [!TIP]` 綠訣竅、`> [!WARN]` 紅注意、`> [!QUOTE]` 紫金句、`> [!NOTE]` 灰補充/中繼資料、`> [!EX]` 例子、`> [!FIG]` 靛色圖示重建（見 ①）。**框內可以放清單，甚至表格**（要點就用 `> - 項目` 清單）；多行內容用**清單**或**空 `> ` 行**分段，不要用一行行硬湊。
- **表格用 GFM pipe 格式**（`| 欄 | 欄 |` ＋ `|---|---|`），別用 HTML `<table>`。比較、步驟對照、分類很適合。
- **Prompt／程式碼／指令**用 ```` ``` ```` 圍籬區塊，**別塞進 blockquote**——Prompt 多的課這樣才不會爛版。
- **現場 Q&A** 用 `### Q：問題` 小標＋條列回答（**不要用 `<details>` 摺疊**）。
- `**粗體**` 只標關鍵詞、不整段加粗；`---` 分隔大段落、不濫用。深度＝取代看完影片，但別為了長而灌水。

**④ 檔案**
- 大課（幾十單元）按章節分給多個子代理，各寫各的檔到 `notes/<course>/NNN_note.md`（序號檔名）。
- `_index.md`（可選，排在最前）只寫**散文式課程總覽**：這門課在講什麼、學完能幹嘛、建議閱讀順序。**不要手寫「單元清單／導覽表」**——render.js 會自動把每篇的 `[!KEY] 一句話總結` 抽出來，在課程最前面生成一張可點跳轉的「本課地圖」表（所以每篇務必有那個固定開頭，地圖才完整）。

### 6. 產出 HTML（Render）
`node render.js <notes_dir> <output.html> "<標題>" [語言]`（**`[語言]` 只支援 `zh-Hant` 或 `en`**，其他值退回 `zh-Hant`；只影響介面文字，筆記內文語言由上一步決定）：把 notes/ 組成一份 self-contained 漂亮 HTML（內嵌 CSS/JS、左側課程導覽、可跳轉、即時搜尋、**自動「本課地圖」總表（>3 篇時，抽每篇一句話總結、可跳轉）**、**彩色重點框 callout（`> [!KEY/TIP/WARN/QUOTE/NOTE/EX/FIG]`，框內可放清單/表格）**、GFM 表格、圍籬程式碼、`- [ ]` 可勾選待辦（記住勾選狀態）、可列印）。**要換品牌主色**：改 render.js CSS 裡的 `--accent`（預設 `#0091AC`）。**不綁 Notion**——這是預設交付格式，零帳號、任何瀏覽器可開。

### 7. 回報（Telemetry）
跑完呼叫 `node telemetry.js notes_done <筆記數> <媒體類別>`（見 README 揭露）。首次執行會顯示**告知**（預設開、可關），非需勾選的同意。**第一次執行時，把告知內容在對話裡轉述給使用者**（會回傳哪些匿名計數、用 `COURSE2NOTES_TELEMETRY=off` 可關）——它印在 shell 輸出裡、使用者自己看不到。只回傳匿名計數，絕不含內容／網址／課名。**`platform` 參數只能填媒體類別（`vimeo`／`soundcloud`／`youtube`／`hls`／`text`），絕不可填站台域名或課名**——後台已用白名單擋，填別的會被壓成 `other`。

### 8. 複習模式（選配，交付後可主動告訴使用者）
筆記與 `transcript/` 都留在本機。做完後可提醒使用者：**日後想深入某個點、或考自己，直接在該課資料夾重開 Claude Code 問就好**——逐字稿就是現成語料，等於一個**跑在自己電腦、內容不外流的 NotebookLM**（免上傳、免另辦帳號）。例：「用 001 這篇的逐字稿出 5 題選擇題考我」「把第 3 章的重點濃縮成一頁」。這不需要另外做任何東西，是本地檔案的天然延伸。

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
- **隱私收尾**：`chrome-profile/` 裡留著使用者「登入課程平台」的 cookie／登入狀態。全部做完後**主動提醒使用者、並徵求同意刪掉 `chrome-profile/`**（或至少告知它在哪、含登入資訊），別讓它無限期留在硬碟。
- **成本／時間預期**：跑起來吃的是**使用者自己的 Claude Code 方案額度**（做筆記那步最兇，量 ∝ 課程總時長）；無本機顯卡走 `--api` 還會有 OpenAI 費用（約 US$0.006/分）。大課（幾十小時）開跑前，先估個大概、跟使用者講一聲，別讓他中途撞到方案上限或帳單嚇到。

## 腳本清單與呼叫簽名（本技能夾內）
- `node recon.js <課程網址> [cdp]` — 偵察，dump 連結樣式與偵測到的媒體 host（cdp 預設 `http://localhost:9222`）
- `node sniff.js <urls.txt> <out.json> [origin] [cdp]` — 逐一用瀏覽器載入單元頁、攔 vimeo/soundcloud/youtube/hls，回填 host 與可下載 URL
- `node download.js <manifest.json> <audio_dir>` — 讀 manifest，對每個可下載項用 yt-dlp 抓 audio-only
- `python transcribe.py <audio_dir> <transcript_dir> [--api]`（**Mac/Linux 用 `python3`**）— 自動選後端：NVIDIA→faster-whisper、Apple Silicon Mac→mlx-whisper（兩者免費本機）、Intel Mac／AMD／無顯卡→OpenAI API（**音檔會上傳 OpenAI**）；`--api` 強制走 API
- `node slides.js <單元視訊> <out_dir> [scene_threshold=0.4] [max=40]` —（選配）ffmpeg 場景偵測抽候選投影片＋時間戳，供子代理挑選嵌入筆記
- `node render.js <notes_dir> <out.html> "<標題>" [語言]` — 產 self-contained HTML（被引用的 `slides/*.jpg` 自動內嵌成 data URI、可點擊放大）
- `node telemetry.js <event> [noteCount] [platform]` — 匿名回報；**`platform` 只能填媒體類別（vimeo/soundcloud/youtube/hls/text），絕不可填站台域名或課名**

設定：`config.example.json` 目前只有**遙測**兩個鍵會被讀（`telemetry`、`telemetryEndpoint`）。其餘設定走參數或環境變數——CDP 端點用 recon/sniff 的 argv、語言用 render 的 `[語言]` 參數、主色改 render.js 的 `--accent`、GPU/語言用 `COURSE2NOTES_*` 環境變數。
