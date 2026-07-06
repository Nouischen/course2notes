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
0. **確保相依套件就緒**：由你（agent）在對話裡自己跑，別叫使用者開 CMD。**每次跑前先做一次便宜的快檢**（不是每次都重裝）：`node -e "require.resolve('playwright-core')"` 與 `<python> -m yt_dlp --version` 有沒有過——過了就直接往下，沒過才做下面完整安裝（`/plugin` 安裝的技能更新後 node_modules 可能被重置，所以別假設「裝過就永遠在」）。
   - **系統層級先體檢**：依序確認 `node --version`（**要 ≥ v18**，太舊視同缺、要升級——playwright-core 需要）、Python（Windows 試 `python`/`py`，Mac/Linux 試 `python3`；**Windows 若打 `python` 跳出 Microsoft Store，那是假的佔位程式、不是 Python**，要裝真的）、`ffmpeg -version`、瀏覽器（Chrome **或 Edge/Brave 皆可**）是否存在。**缺了先徵求使用者同意、然後由你代裝**：Windows 用 `winget install --accept-source-agreements --accept-package-agreements <pkg>`（`OpenJS.NodeJS.LTS`／`Python.Python.3.12`／`Gyan.FFmpeg`；瀏覽器通常已有 Edge、免裝），Mac 見下一條（brew 要使用者自己在 Terminal 跑）。winget 需要系統管理員權限，非管理員帳號會失敗→改給官方下載連結手動裝。
   - **磁碟空間**：本機轉錄要下載約 3GB 模型＋課程音檔，**開跑前先看剩餘空間**（Windows `Get-PSDrive C`、Mac/Linux `df -h ~`）；GPU 路徑低於約 10GB、API 路徑低於約 3GB 就先提醒使用者清一下再繼續。
     - **macOS 沒有預裝 Homebrew**（Windows 的 winget 在 Win10/11 已預裝）。**⚠️ brew 你（agent）代裝不了**——它的安裝腳本要 TTY、還要輸入使用者的 Mac 密碼（sudo），在你的無終端機環境會直接 abort（`Need sudo access on macOS`）。所以若 `brew` 不存在，**這是少數要請使用者自己動手的一步**：請他打開「終端機 Terminal.app」、貼上 `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`、依畫面按 Enter 並輸入 Mac 密碼（會跳 **Xcode Command Line Tools** 安裝框，按同意）。裝完請他跑 `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"` 把 brew 加進 PATH。**或**乾脆跳過 brew，給官方安裝檔手動裝：Node（nodejs.org 的 .pkg）、Python（python.org 的 .pkg）、Chrome（google.com/chrome）、ffmpeg。
     - **macOS 還要先確認 Xcode CLT**：`xcode-select -p` 失敗代表沒裝——`git`／`python3` 其實是會跳 GUI 安裝框的假殼，第一次用會卡住。先提醒使用者「等一下會跳一個系統安裝框，請按安裝」。
     - **手動下載的 ffmpeg（如 evermeet.cx）在 Mac 會被 Gatekeeper 隔離**（`ffmpeg cannot be opened`）——請使用者跑 `xattr -d com.apple.quarantine <ffmpeg 路徑>` 解隔離。**優先用 `brew install ffmpeg`** 免這問題。
     - **⚠️ 用 winget/brew 裝完系統工具後，正在執行的 Claude Code 讀不到新的 PATH**（環境變數是行程啟動時的快照）——請使用者**完全關閉並重開 Claude Code** 再繼續，否則接下來的 `node`／`python`／`ffmpeg` 會「找不到指令」即使剛剛裝成功。（同理，`OPENAI_API_KEY` 設完系統環境變數也要重開；或當次改用 inline 帶入。）
   - Node：在**技能自己的資料夾**跑 `npm install`（裝 `playwright-core`；本技能只用它當 CDP 客戶端連使用者的瀏覽器，不下載瀏覽器）。**Windows 上用 `npm.cmd install`**（PowerShell 可能先解析到 `npm.ps1`、被執行原則擋成「running scripts is disabled」）。若 `npm install` 報快取寫入權限錯（`EPERM ...npm-cache`，防毒/受控資料夾存取常見），改把快取指到技能夾內：`npm install --cache .npm-cache`。
   - Python（**用剛才體檢時可用的那個直譯器**：Windows 可能是 `python` 或 `py`，Mac/Linux 是 `python3`；下載與轉錄要用同一個，套件才裝得到對的地方）：**一律用 `<那個直譯器> -m pip` 裝、不要用裸 `pip`／`pip3`**（裸 pip 常屬於另一個 Python，會裝到 download.js／transcribe.py 用不到的地方）。例：`py -m pip install -r requirements.txt`（Windows）／`python3 -m pip install -r requirements.txt`（Mac/Linux），先裝 yt-dlp；轉錄再**三選一**——① **有 NVIDIA 顯卡（Windows/Linux）** `pip install -r requirements-gpu.txt`（含 faster-whisper＋CUDA 執行期 cuDNN/cuBLAS，缺了會 `Unable to load libcudnn`）；② **Apple Silicon Mac（M 系列）** `pip install -r requirements-mac.txt`（裝 mlx-whisper，吃 Mac GPU、免費本機轉錄）；③ **Intel Mac 或都沒有** `pip install -r requirements-api.txt`（走 OpenAI API）。**別在 macOS 裝 GPU 檔**（nvidia-* wheel 在 Mac 裝不起來）。
     - **⚠️ 若 pip 報 `externally-managed-environment`**（Homebrew 的 Python、Debian/Ubuntu 的系統 Python 都會擋，PEP 668）：加 `--break-system-packages`（例：`pip3 install --break-system-packages -r requirements.txt`）。這會裝進 download.js／transcribe.py 會用到的同一個系統直譯器；**別改用 venv**——那樣 download.js 從 PATH 找 `python -m yt_dlp` 會找不到套件。
   - **只有「沒有免費本機路徑」的機器才要 OpenAI 金鑰**——即 **Intel Mac、AMD/Intel 顯卡、沒有顯卡** 的 Windows（**Apple Silicon Mac 與 NVIDIA 顯卡都免金鑰、走本機**，別叫他們去辦金鑰）。若屬前者且沒有 `OPENAI_API_KEY`，先引導使用者到 platform.openai.com/api-keys 建一把（需綁付款），當次用 **inline 帶入**——**注意環境變數只在「同一條命令列」有效，不會跨到下一個 shell 呼叫**，所以要和 transcribe 指令**寫在同一行**：Windows `$env:OPENAI_API_KEY='sk-...'; python transcribe.py ... --api`、Mac/Linux `OPENAI_API_KEY=sk-... python3 transcribe.py ... --api`。**別等轉錄那步才發現沒金鑰、白下載一小時。**
   - 相依都就緒後，發一次安裝計數：`node telemetry.js install`（這也會在此時印出「首跑匿名計數告知」——請你把它轉述給使用者，並告知 `COURSE2NOTES_TELEMETRY=off` 可關）。
1. **工作區資料夾**：選一個**純本機、路徑不含空白/中文最好**的資料夾當工作區，例：`%USERPROFILE%\course2notes-work`（Mac：`~/course2notes-work`）。**別放在 OneDrive／iCloud／桌面這種會雲端同步的位置**——同步鎖檔會讓 chrome-profile 與下載檔壞掉。
2. **不用**請使用者關掉原本的 Chrome——下一步開的是**獨立設定檔的另一個實例**，並存不衝突。
3. **任何 Chromium 系瀏覽器都可以**（不限 Google Chrome）——CDP 對 **Chrome／Edge／Brave** 都通。Windows 幾乎都預裝 **Edge**，找不到 Chrome 就直接用 Edge，別卡在「要先裝 Chrome」。**找瀏覽器執行檔的順序**：
   - Windows：先查登錄檔 `HKLM/HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe`（或 `msedge.exe`），再試 `C:\Program Files\Google\Chrome\Application\chrome.exe`、`C:\Program Files (x86)\...`、**每人安裝**的 `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`、Edge 的 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`。
   - macOS：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`（或 `Microsoft Edge`／`Brave Browser`）。
4. **先確認 9222 沒被占用**：探 `http://127.0.0.1:9222/json/version`——**若已經有回應**，代表別的 Chrome 早就占著這個埠（你會連到錯的瀏覽器！），**改用另一個埠**（如 9333）並把它一路帶到 recon/sniff 的 CDP 參數。
5. **你自己用 shell 啟動**（依上面找到的執行檔路徑）。Windows（PowerShell，**引號要包在元素裡面**，否則工作區路徑有空白會被拆開）：
   `Start-Process "<瀏覽器執行檔路徑>" -ArgumentList '--remote-debugging-port=9222',"--user-data-dir=<工作區>\chrome-profile",'--no-first-run','<課程網址>'`
   macOS：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="<工作區>/chrome-profile" --no-first-run "<課程網址>" &`
6. 確認 `http://127.0.0.1:9222/json/version` 有回應（**用 127.0.0.1 不要用 localhost**——Node<20 可能解析到 IPv6 ::1 而連不上）。
7. **請使用者在跳出的視窗登入課程平台、打開那門課，回你「好了」**。
之後所有偵察/抓取都用 `chromium.connectOverCDP('http://127.0.0.1:9222')`（埠改過就換埠）連它、用既有 context（已登入）。
- **第二次跑／當掉後**：若上次的 chrome-profile 還被鎖（`chrome-profile/Singleton*` 存在且有殘留 Chrome 行程），別重用——關掉殘留行程或改用新的 profile 資料夾，否則新視窗可能接到舊行程或靜默失敗。

## 流程總覽（步驟 0–8）

### 1. 偵察（Recon）— 這步是靈魂，要臨場判斷
連上 CDP，載入使用者給的課程網址，觀察：
- **結構**：課程 → 章節 → 單元 的層級與網址型態（列出頁面上的連結、找出重複的路徑樣式）。注意有些平台「每個章節頁都會列出整門課大綱」→ 列舉時要按「屬於該章節」過濾去重（我們在 LearnDash 踩過）。
- **媒體來源**：打開一個真的單元頁，攔網路請求，看影片/音訊掛在哪。常見：`player.vimeo.com/video/<id>`（Vimeo 私人嵌入）、`w.soundcloud.com/player?...tracks/<id>...secret_token=`（SoundCloud 私人音軌）、`youtube.com/embed/<id>`、`.m3u8`（HLS）、直接 `<video src>`。**ID 常只出現在網路請求、不在原始 HTML** → 要用瀏覽器載入攔請求，不能只抓靜態 HTML。
- **字幕優先（強烈建議先找）**：偵察時順手看有沒有**官方字幕／逐字稿軌**——Vimeo 的 `texttrack`／`.vtt`、YouTube captions、平台自帶的字幕或講義逐字稿。**有字幕就字幕優先**：直接抓字幕檔（yt-dlp 可用 `--write-subs`／`--write-auto-subs --sub-langs <lang> --skip-download`，或攔 `.vtt`/`.srt` 網址下載）當逐字稿，**跳過下載音訊＋whisper 這兩步**，品質（人工字幕沒有 ASR 錯字）與速度都大勝。**whisper 只當沒有字幕時的 fallback**。（sat.cool 的 Vimeo 字幕軌驗過非常成功。）
- **純文字課**：若單元頁沒有任何影音、而是文章（如「百科」類），改走「爬文字」路徑（抓內文容器的 innerText），跳過下載與轉錄。
- **拿不到的**：標「已下架／DRM 加密」的單元記錄下來、告知使用者，不要卡住。
- **投影片型 vs 純講者（決定要不要截圖，順手判一下）**：抽一個真的單元、瞄一眼畫面，判斷這門課主要是「投影片型」（畫面是圖表／示意圖／軟體操作／照片等**非文字資訊**）還是「純講者頭像／口播」或「投影片只有文字條列」。把這個判斷記下來——它決定下一段要不要問使用者做投影片截圖。
- **→ 投影片截圖詢問點（偵測到投影片型才問；就在這裡問、別拖到最後）**：**只有**判定為「投影片型、且圖上有非文字資訊」時，才**在開始下載前**用選項式提問問使用者一次：「偵測到這門課是投影片型（有圖表／示意圖／軟體畫面）。要不要一併擷取投影片截圖、把真實圖表嵌進筆記？代價是多下載一份低解析影片、多花些時間。**建議：開。**」把答案記下來，交給步驟 4.5 執行。**判定為純講者／純文字投影片的課，不做也不問**（預設略過、維持舊行為，別拿無關的問題打擾使用者）。使用者說「你決定／都可以」時，投影片型預設做、純講者預設不做。
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
**轉錄一開始，transcribe.py 會印一行 `[backend] 本次轉錄後端 = CUDA／MLX／API｜…`——把這行明確轉述給使用者**（他看不到 shell 輸出）：讓他一眼知道走了本機 NVIDIA GPU、Apple Silicon、還是雲端 API，以及對應的速度、費用、音檔是否上雲。若他嫌太慢或不想音檔上雲，這行能立刻讓他判斷該不該換一台機器跑。
語言：預設讓 Whisper **自動偵測**（英文課→英文逐字稿、中文課→中文）。只有在你明確知道語言、要強制時才設環境變數 `COURSE2NOTES_LANG`（如 `zh`／`en`／`ja`）。**別預設塞 `zh`**，否則英文課會被硬套中文 ASR 產出亂碼。
非零離開碼＝有單元轉錄失敗或根本沒有音檔（exit 3）——先查原因，別帶著缺漏 render。
本機轉錄第一次會從 **huggingface.co 下載約 3GB 模型**（只需一次）。**公司／醫院網路或某些地區常擋 HuggingFace**——若 transcribe.py 印出「模型下載失敗（網路/防火牆問題）」，設 `HF_ENDPOINT=https://hf-mirror.com` 換鏡像、或換一個網路重跑（訊息已會分辨這是網路問題而非顯卡問題）。
注意：中文輸出常「簡繁混雜＋術語誤聽」，這在下一步筆記階段修（一律輸出繁體、依上下文修 ASR 錯字）。

### 4.5 投影片截圖（依步驟 1「投影片截圖詢問點」使用者的選擇執行）
**做不做，取決於步驟 1 問使用者的結果**：偵測到投影片型、且使用者回答「要」，才做這步；純講者／純文字投影片的課、或使用者回答「不要」，就整步跳過（維持舊行為，跳過不影響其餘流程）。要做的話——投影片上的**非文字資訊**（圖表、示意圖、軟體操作畫面、照片）嵌進筆記，讓「圖示重建」直接用真圖；純文字條列的投影片別截（字已在逐字稿裡，只會讓筆記肥大）。（流程很長、你已不確定使用者稍早在步驟 1 的選擇時，**別憑猜**——回頭跟他確認一句「要不要做投影片截圖」再決定做或不做。）

1. **多抓一路低解析視訊**（音訊照舊）：只對要做投影片的單元，用 yt-dlp 抓一份小檔視訊暫用，例：`yt-dlp -f "bv*[height<=480]/wv*/worst" --no-playlist -o "<slides工作區>/<idx>.%(ext)s" <downloadUrl>`（帶必要的 `--referer`）。抽完圖可刪。
2. **抽候選投影片**：`node slides.js <該單元視訊> notes/<course>/slides/<單元序號>/ [threshold=0.4] [max=40]`——ffmpeg 場景偵測抽出畫面明顯變化的候選格，存 `slides/<單元序號>/NNN.jpg` ＋ `slides.json`（含各張時間戳）。零額外相依。**⚠️ 每個單元一定要用自己的子資料夾**——slides.js 每次都從 001 編號、會整夾重寫 slides.json，兩個單元共用同一夾會互相覆蓋、造成圖文不符。筆記引用寫 `![說明](slides/<單元序號>/NNN.jpg)`（render.js 支援巢狀路徑）。
3. **子代理挑選（關鍵、也是我們比別人強的地方）**：做筆記子代理**直接看這些候選圖**（多模態），**只留有非文字資訊的**。挑選用**寧缺勿濫**這把尺——問自己「**拿掉這張圖，讀者會不會少懂一個具體資訊？**」不會，就不要。**明確排除：講者頭像／半身鏡頭、純裝飾插圖、過場動畫、標題頁、糊掉或看不清的、和已選圖幾乎一樣的重複。**（實測發現多模態代理容易手滑把講者頭像也選進去——別。）真正要留的是：**數據圖表、比較表、流程／架構／象限示意圖、軟體或 AI 介面截圖、有標註的照片**。一堂課常只留 4～10 張。挑中的用 `![一句話說明](slides/NNN.jpg)` 放到對應段落（用 `slides.json` 時間戳對齊逐字稿）；能順手把圖上的表格/清單也重建成 HTML 更好。
4. **自足性不變**：圖是加分，配的說明要能脫離圖獨立看懂（見 5-①）。
5. **圖文相符複驗（務必做）**：寫完後，逐一回頭核對每個 `![說明](slides/NNN.jpg)` 的**圖真的就是說明講的那張**——別把講者頭像／過場配上「某某圖表」的說明（實測踩過：選圖與最終複製對不上，結果一張人臉被標成數據圖）。用 Read 打開每張被引用的圖確認內容吻合，不吻合就改說明或換圖／拿掉。

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
- **重建要講「概念」，不是描述「畫面長怎樣」**（很容易犯的隱性錯）：`[!FIG]` 的表格要用**真正的變數/概念**當欄位，不要用「圓圈／顏色／方塊／位置」當欄位。
  - ❌ 繞著畫面：`| 圓圈 | 代表 | 規模 |` → `| 藍色大圈 | Google | 最大 |`（讀者沒看過那張圖，「藍色大圈」是空的）
  - ✅ 繞著概念：`| 流量來源 | 現況 | 對 SEO 的意義 |` → `| 傳統搜尋(Google) | 仍全球最高 | 原本就有 |`／`| AI 搜尋(ChatGPT) | 已進前十、持續變大 | 額外新增 |`／`| 兩者相加 | > 只有傳統搜尋 | 市場變大 |`
  - 同理，內文、關鍵詞、測驗、單字卡也**別用「藍圈＋綠圈」這種畫面式簡寫**，改用「傳統搜尋＋AI 搜尋」這種概念式講法。**目標：把圖整個拿掉，這段文字仍完整成立。**
- **圖是加分、不是文字的替身**：文字永遠要能脫離圖獨立看懂（圖可能沒載入、可能黑白列印）。**只能指涉「當場真的嵌進去的圖」**（可以說「下圖…」因為讀者看得到）；**絕不指涉缺席的東西**（「左邊紅圈圈」這種，圖不在就是壞的）。

**② 完整保真、去口水**
- 保留所有**框架、步驟、實際數字、案例、話術、講者的觀點與金句、現場 Q&A** ——深度＝「取代看完影片」。
- 去掉的是：口頭贅字、重複、「呃/那個/對」、跟內容無關的閒聊、以及上面說的指涉畫面的話。
- **筆記語言＝使用者發問／指定的語言**（落地頁與 README 都是這樣承諾的）：使用者用中文問就用**繁體中文**、用英文問就用英文，句尾有指定（如「筆記用英文」）就照指定；沒任何線索時，預設跟著逐字稿的語言、中文一律繁體。依上下文修明顯的 ASR 錯字（術語、人名）；**不杜撰**數字或情節，判讀不出標「（口述不清）」，不要自己補。

**③ 版面與結構（只用 render.js 認得的語法，做出好吸收、可掃讀的筆記）**

**固定開頭（每篇同位置、同樣式，讓讀者 30 秒內判斷要精讀或跳讀）**：
- `# 單元標題`
- `> [!NOTE] 課名 · 章節/單元序號 · 影片長度`（放中繼資料；長度不確定就省略。**別用裸 `>` 引言放這行**，那會渲染成金句框、語義錯）
- `> [!KEY] 一句話總結` —— 單句、含**粗體**核心主張，是讀者離開後唯一記得住的鉤子。**英文筆記標題固定用 `In one sentence`**（render.js 的本課地圖靠這個標題抽摘要，別自創其他說法）
- `> [!KEY] 你會學到` —— 底下接 3–5 條**清單**（`> - 項目`）

**接著**：
- `## 內容筆記`：內部用**真的 `###` 小標**分主題（別只用粗體行當標題——粗體沒有層級、也進不了導覽）。逐主題保留框架/推導/例子/數字/話術。
  - （選配）主題小標後可加該段在影片的時間 `⏱ 12:34`（用 `transcript/*.timestamped.txt`）——方便使用者回原課程找該段。**注意：無法點擊跳轉**（嵌不了平台影片），只是給人工定位用，別過度標。
- 課程有 **3 個以上專有名詞**時，加 `## 關鍵詞`：用清單列「**術語**：在這門課裡的意思」，讓讀者不用回頭查。
- 結尾 `## 可執行要點`：用**待辦清單** `- [ ] 動作`——render.js 會渲染成可勾選、且重開 HTML 仍記得勾選狀態的核取方塊。
- （選配，內容夠份量再加）**隨堂測驗／單字卡**——用 JSON 圍籬區塊，render.js 會渲染成互動小工具：
  - 測驗：```` ```quiz ````＋`[{"q":"問題","options":["選項…"],"answer":正解的0起始索引,"explain":"為什麼(選填)"}]`。出 2–5 題，**考理解不考冷知識**，正解要無爭議、explain 說明為什麼。
  - 單字卡：```` ```flashcards ````＋`[{"front":"術語/問題","back":"定義/答案"}]`。挑本單元關鍵詞。
  - JSON 要合法（壞掉會退回當程式碼區塊）；薄的單元別硬塞。

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
`node render.js <notes_dir> <output.html> "<標題>" [語言]`（**`[語言]` 只支援 `zh-Hant` 或 `en`**，其他值退回 `zh-Hant`；只影響介面文字，筆記內文語言由上一步決定）：把 notes/ 組成一份 self-contained 漂亮 HTML（內嵌 CSS/JS、左側課程導覽、可跳轉、即時搜尋、**自動「本課地圖」總表（3 篇以上的課，抽每篇一句話總結、可跳轉）**、**彩色重點框 callout（`> [!KEY/TIP/WARN/QUOTE/NOTE/EX/FIG]`，框內可放清單/表格）**、GFM 表格、圍籬程式碼、`- [ ]` 可勾選待辦（記住勾選狀態）、**互動 `quiz` 測驗／`flashcards` 單字卡**、被引用的投影片截圖、可列印）。**要換品牌主色**：改 render.js CSS 裡的 `--accent`（預設 `#0091AC`）。**不綁 Notion**——這是預設交付格式，零帳號、任何瀏覽器可開。

### 7. 回報（Telemetry）
跑完呼叫 `node telemetry.js notes_done <筆記數> <媒體類別>`（見 README 揭露）。首次執行會顯示**告知**（預設開、可關），非需勾選的同意。**第一次執行時，把告知內容在對話裡轉述給使用者**（會回傳哪些匿名計數、用 `COURSE2NOTES_TELEMETRY=off` 可關）——它印在 shell 輸出裡、使用者自己看不到。只回傳匿名計數，絕不含內容／網址／課名。**`platform` 參數只能填媒體類別（`vimeo`／`soundcloud`／`youtube`／`hls`／`text`），絕不可填站台域名或課名**——後台已用白名單擋，填別的會被壓成 `other`。

### 8. 交付與複習模式（做完務必告知位置）
**交付時一定要用純文字把兩個路徑講清楚給使用者**（不然他們找不到，「雙擊 HTML」「重開 Claude Code」都無從做起）：① 產出的 **HTML 檔完整路徑**（「雙擊它就能看筆記，也可以我幫你打開」）；② 這門課的**資料夾路徑**（複習模式要用）。
**複習模式**：筆記與 `transcript/` 都留在本機。提醒使用者：**日後想深入某個點、或考自己，就在上面那個課程資料夾重開 Claude Code 問就好**——逐字稿就是現成語料，等於一個**跑在自己電腦、內容不外流的 NotebookLM**（免上傳、免另辦帳號）。例：「用 001 這篇的逐字稿出 5 題選擇題考我」「把第 3 章的重點濃縮成一頁」。這不需要另外做任何東西，是本地檔案的天然延伸。

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
- **公司／醫院網路的 SSL 攔截**：若 pip／npm 報憑證錯（`CERTIFICATE_VERIFY_FAILED`／`self signed certificate in certificate chain`），代表網路在做 TLS 檢查——請 IT 給企業 CA 憑證，設 `NODE_EXTRA_CA_CERTS=<pem>`、`PIP_CERT=<pem>`／`REQUESTS_CA_BUNDLE=<pem>`（別教使用者關掉憑證驗證）。
- **只有 proxy 的網路**：Chrome 能上網（走系統/PAC proxy）但 `npm install` 逾時＝npm 沒吃系統 proxy → 設 `npm config set proxy`／`https-proxy`，或 `HTTPS_PROXY` 環境變數給 pip/yt-dlp。
- **埠 9222 已被占用**＝別的 Chrome 早就開著除錯埠，你會連到錯的瀏覽器 → 換埠（見前置步驟）。
- **隱私收尾**：`chrome-profile/` 裡留著使用者「登入課程平台」的 cookie／登入狀態。全部做完後**主動提醒使用者、並徵求同意刪掉 `chrome-profile/`**（或至少告知它在哪、含登入資訊），別讓它無限期留在硬碟。
- **成本／時間預期**：跑起來吃的是**使用者自己的 Claude Code 方案額度**（做筆記那步最兇，量 ∝ 課程總時長）；無本機顯卡走 `--api` 還會有 OpenAI 費用（約 US$0.006/分）。大課（幾十小時）開跑前，先估個大概、跟使用者講一聲，別讓他中途撞到方案上限或帳單嚇到。

## 腳本清單與呼叫簽名（本技能夾內）
- `node recon.js <課程網址> [cdp]` — 偵察，dump 連結樣式與偵測到的媒體 host（cdp 預設 `http://127.0.0.1:9222`）
- `node sniff.js <urls.txt> <out.json> [origin] [cdp]` — 逐一用瀏覽器載入單元頁、攔 vimeo/soundcloud/youtube/hls，回填 host 與可下載 URL
- `node download.js <manifest.json> <audio_dir>` — 讀 manifest，對每個可下載項用 yt-dlp 抓 audio-only
- `python transcribe.py <audio_dir> <transcript_dir> [--api]`（**Mac/Linux 用 `python3`**）— 自動選後端：NVIDIA→faster-whisper、Apple Silicon Mac→mlx-whisper（兩者免費本機）、Intel Mac／AMD／無顯卡→OpenAI API（**音檔會上傳 OpenAI**）；`--api` 強制走 API
- `node slides.js <單元視訊> <out_dir> [scene_threshold=0.4] [max=40]` —（依步驟 1 使用者選擇；投影片型才做）ffmpeg 場景偵測抽候選投影片＋時間戳，供子代理挑選嵌入筆記
- `node render.js <notes_dir> <out.html> "<標題>" [語言]` — 產 self-contained HTML（被引用的 `slides/*.jpg` 自動內嵌成 data URI、可點擊放大）
- `node telemetry.js <event> [noteCount] [platform]` — 匿名回報；**`platform` 只能填媒體類別（vimeo/soundcloud/youtube/hls/text），絕不可填站台域名或課名**

設定：`config.example.json` 目前只有**遙測**兩個鍵會被讀（`telemetry`、`telemetryEndpoint`）。其餘設定走參數或環境變數——CDP 端點用 recon/sniff 的 argv、語言用 render 的 `[語言]` 參數、主色改 render.js 的 `--accent`、GPU/語言用 `COURSE2NOTES_*` 環境變數。
