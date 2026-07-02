# Course2Notes

> Turn the online courses you **never finish** into notes you'll **actually read** — in one click, from inside Claude Code.

**English** · [中文](#中文-course2notes)　|　License: MIT · Author: Dr. Yu-Chieh Chen

![Course2Notes sample notes](site/preview-en.png)

Course2Notes is an open-source **[Claude Code](https://www.claude.com/product/claude-code) skill**. Point it at a course you've bought, and it turns the whole thing into one clean, self-contained **HTML** you can actually read. It runs on **your own computer and your own AI** — the author never sees your content. (Transcription is local when you have a GPU; without one, the OpenAI API mode uploads only the audio to OpenAI — see [Privacy](#privacy).)

You don't run any commands or need any tech skills: you just **talk to Claude Code**, and it installs itself, opens the browser, downloads, transcribes, and writes the notes for you. The only thing you do by hand is log in to your course platform.

## Why it's different

- **Adaptive, not a fixed scraper.** It doesn't rely on brittle per-site scrapers. Your Claude Code **reads each platform on the fly** and figures out how to grab it — so it adapts to many different course sites.
- **Runs on your machine, your AI.** You use your own Claude Code and your own compute, and **the author never receives any of your content**. With an NVIDIA GPU, transcription runs locally and nothing leaves your computer; with no GPU, the OpenAI API mode sends only the audio to OpenAI to transcribe (see [Privacy](#privacy)).
- **Beautiful HTML — no Notion, no account.** The output is a single self-contained HTML file: sidebar navigation, search, collapsible sections, adjustable font size, and print-to-PDF. Opens in any browser.
- **Private by design.** Anonymous usage counts only — never your notes, course names, URLs, or files. See [Privacy](#privacy).

## What you need

- **Claude Code** — the **desktop app (Local mode)** or the **CLI**. *(The web version, claude.ai/code, runs in the cloud and can't reach your computer, so it won't work.)*
- **Node.js**, **Python**, **ffmpeg**, and **Google Chrome** installed on your system.
- **Transcription**: an **NVIDIA GPU** (free, local Whisper — the skill also installs the CUDA cuDNN/cuBLAS runtime it needs) — or, with no GPU, an **`OPENAI_API_KEY`** (~US$0.006/min).
- Desktop only. You must own the course and be able to log in to it.

> The skill installs its own libraries automatically the first time it runs — `playwright-core` (via `npm install`) plus `yt-dlp` and the Whisper/OpenAI transcription package (via `pip`). You don't install those by hand. Prefer to do it yourself? Run `npm install` and `pip install -r requirements.txt` inside the skill folder.

## Install

**1. Get Claude Code** — pick one:

- **Desktop app** (recommended, no terminal): https://code.claude.com/docs/en/desktop — open it and choose **Local** mode.
- **CLI**:
  - macOS / Linux: `curl -fsSL https://claude.ai/install.sh | bash`
  - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`

**2. Install this skill** — in Claude Code, just say:

```
Install the skill from github.com/Nouischen/course2notes into ~/.claude/skills/course2notes — I'll use it to turn online courses into notes
```

Then **restart Claude Code once** so the skill loads.

<details>
<summary>What Claude actually does (or do it yourself)</summary>

The skill must end up at `~/.claude/skills/course2notes/SKILL.md` — that exact location is how Claude Code discovers it.

- With git — macOS/Linux: `git clone https://github.com/Nouischen/course2notes ~/.claude/skills/course2notes` · Windows (PowerShell): `git clone https://github.com/Nouischen/course2notes "$env:USERPROFILE\.claude\skills\course2notes"`
- No git? Download [main.zip](https://github.com/Nouischen/course2notes/archive/refs/heads/main.zip) and extract it there. The zip unpacks to a folder named `course2notes-main` — rename it to `course2notes` so `SKILL.md` sits directly under `~/.claude/skills/course2notes/`.
</details>

## Use it (3 steps — all by talking to Claude Code)

1. **Install** (once) — the line above.
2. **Make notes** — say: `Use course2notes to turn https://your-course-url into notes`
3. **Log in once** — it opens a browser window; you log in to your course platform and open the course, then tell it "done". It runs the rest automatically: **detect platform → download audio → transcribe → write notes → generate a clean HTML.** Double-click the HTML and there are your notes.

> Notes come out in the language you write in. Want a specific one? Just add e.g. *"notes in English"*.

> Along the way Claude Code shows permission prompts (installing packages, opening the browser, running scripts) — approving them is normal and expected.

## Supported platforms

It isn't a fixed scraper, so it adapts — but it can't beat hard DRM.

| Type | Supported |
|---|---|
| Platforms using Vimeo / SoundCloud / YouTube / HLS (LearnDash-, Teachify-style sites, and more) | ✅ Yes |
| Text / article-based courses | ✅ Yes |
| Hard-DRM encrypted streams (some large platforms) | ✘ No |

## Privacy

By default, Course2Notes sends **one anonymous usage ping** so we can gauge how many people use it. It includes **only**: a random local ID (not traceable to you), the event (install / notes done), how many notes this run, the platform type, version, and a timestamp.

It **never** collects your notes, course names, URLs, or any personal data or files. The code is open — check `telemetry.js` yourself. Turn it off any time: set `COURSE2NOTES_TELEMETRY=off`.

**About transcription:** with an NVIDIA GPU, your audio is transcribed locally and never leaves your computer. Without a GPU, the `--api` mode sends your audio to **OpenAI** for transcription — that is between you and OpenAI, governed by their API data policy; the author still receives nothing. Want everything to stay on your machine? Use a GPU.

## Disclaimer

This tool is only for making **personal study notes** from courses you have **legally purchased and have the right to access**. What's distributed is the tool, not any course content. Follow your platform's Terms of Service and copyright law; do not redistribute or resell anything you download or generate. You are responsible for how you use it.

## Author

**Dr. Yu-Chieh Chen（陳昱傑醫師）**

## License

MIT

---

# 中文 Course2Notes

> 把你**買了卻看不完**的線上課程，一鍵變成**讀得完**的漂亮筆記——全程在 Claude Code 裡完成。

[English](#course2notes) · **中文**　|　授權：MIT · 作者：陳昱傑醫師

Course2Notes 是一個開源的 **[Claude Code](https://www.claude.com/product/claude-code) 技能**。把課程網址交給它，它就把整門課變成一份乾淨、自成一檔的 **HTML** 筆記。全程跑在**你自己的電腦、你自己的 AI** 上——作者看不到你的內容。（有顯卡時轉錄在本機；沒顯卡而用 OpenAI API 模式時，只有音檔會上傳給 OpenAI——見下方隱私。）

你**不用打任何指令、不用懂技術**：用講話的方式跟 Claude Code 說，它就自己幫你安裝、開瀏覽器、下載、轉錄、做筆記。你唯一要動手的，是登入你的課程平台。

## 為什麼不一樣
- **臨場適應，不是固定爬蟲。** 它不靠脆弱的逐站爬蟲，而是讓你的 Claude Code **臨場看懂每個平台**、自己想辦法抓——所以能適應很多課程網站。
- **跑在你的電腦、你的 AI。** 用你自己的 Claude Code 與算力，作者不為你的用量付費，**作者也收不到你的任何內容**。有 NVIDIA 顯卡時轉錄完全在本機、內容不離開你的電腦；沒顯卡而用 OpenAI API 模式時，只有音檔會上傳給 OpenAI 轉錄（見下方隱私）。
- **漂亮 HTML——免 Notion、免註冊。** 輸出是單一自成一檔的 HTML：側欄導覽、搜尋、可折疊、可調字級、可列印 PDF，任何瀏覽器都能開。
- **隱私優先。** 只回傳匿名計數，絕不含你的筆記、課名、網址或檔案（見下方隱私）。

## 你需要
- **Claude Code**——**桌面版 App（Local 本機模式）** 或 **CLI 終端機版**。*（網頁版 claude.ai/code 跑在雲端、碰不到你的電腦，不能用。）*
- 系統先裝好 **Node.js**、**Python**、**ffmpeg**、**Google Chrome**。
- **轉錄**：有 **NVIDIA 顯卡**（免費、本機 Whisper——技能會一併裝好所需的 CUDA cuDNN/cuBLAS 執行期）；沒顯卡則需 **`OPENAI_API_KEY`**（約 US$0.006/分）
- 桌機用。你必須擁有該課程並能登入。

> 技能會在**第一次執行時自動安裝自己的函式庫**——`playwright-core`（`npm install`）以及 `yt-dlp` 和 Whisper／OpenAI 轉錄套件（`pip`），這些你不用自己裝。想自己裝也行：在技能資料夾跑 `npm install` 與 `pip install -r requirements.txt`。

## 安裝
**1. 取得 Claude Code**（二選一）：
- **桌面版 App**（推薦、免終端機）：https://code.claude.com/docs/en/desktop ——開啟時選 **Local 本機模式**。
- **CLI**：
  - Mac / Linux：`curl -fsSL https://claude.ai/install.sh | bash`
  - Windows（PowerShell）：`irm https://claude.ai/install.ps1 | iex`

**2. 安裝本技能**——在 Claude Code 裡直接說：
```
幫我把 github.com/Nouischen/course2notes 這個技能裝到 ~/.claude/skills/course2notes，之後我要用它把線上課程做成筆記
```
然後**重開 Claude Code 一次**讓技能生效。

<details>
<summary>Claude 實際會做什麼（想自己動手也行）</summary>

技能必須落在 `~/.claude/skills/course2notes/SKILL.md` 這個位置，Claude Code 才找得到它。

- 有 git——Mac/Linux：`git clone https://github.com/Nouischen/course2notes ~/.claude/skills/course2notes` · Windows（PowerShell）：`git clone https://github.com/Nouischen/course2notes "$env:USERPROFILE\.claude\skills\course2notes"`
- 沒 git？下載 [main.zip](https://github.com/Nouischen/course2notes/archive/refs/heads/main.zip) 解壓過去。zip 解出來的資料夾叫 `course2notes-main`——要改名成 `course2notes`，讓 `SKILL.md` 直接位於 `~/.claude/skills/course2notes/` 底下。
</details>

## 怎麼用（三步，全程跟 Claude Code 講）
1. **安裝**（一次）——上面那句。
2. **做筆記**——說：`用 course2notes 把 https://你的課程網址 做成筆記`
3. **登入一次**——它會開一個瀏覽器視窗；你登入課程平台、打開那門課，跟它說「好了」。剩下它自動跑完：**偵察平台 → 下載音訊 → 轉逐字稿 → 整理筆記 → 產出漂亮 HTML**，雙擊 HTML 就是你的筆記。

> 筆記預設用你發問的語言。想指定就句尾加一句，例如「筆記用英文」。

> 過程中 Claude Code 會跳出權限確認（裝套件、開瀏覽器、跑腳本）——按「允許」即可，這是正常流程。

## 支援哪些平台
| 類型 | 支援 |
|---|---|
| 影片掛 Vimeo / SoundCloud / YouTube / HLS 的平台（知識衛星、Teachify 類、LearnDash 類…） | ✅ 可 |
| 純文字／文章型課程 | ✅ 可 |
| 硬 DRM 加密串流（部分大型平台） | ✘ 不可 |

## 隱私
預設會回傳**一筆匿名使用計數**：只有一組本機隨機碼（無法對應到你）、事件（安裝／完成筆記）、這次幾份、平台類型、版本、時間。**絕不**收你的筆記內容、課名、網址或任何個資／檔案。程式碼開源，可自查 `telemetry.js`。關閉：設 `COURSE2NOTES_TELEMETRY=off`。

**關於轉錄：** 有 NVIDIA 顯卡時，音檔在本機轉錄、完全不離開你的電腦；沒有顯卡而用 `--api` 模式時，你的音檔會上傳給 **OpenAI** 轉錄——這是你與 OpenAI 之間、適用 OpenAI 的 API 資料政策，作者端仍然收不到任何東西。想全程留在本機就用顯卡。

## 使用聲明
本工具僅供你為**已合法購買、且有權存取**的課程製作**個人學習筆記**。散布的是工具，不是任何課程內容。請遵守你所在平台的服務條款與著作權法，勿散布或轉售下載／產生的內容。使用行為與後果由使用者自行負責。

## 作者
**陳昱傑醫師（Dr. Yu-Chieh Chen）**

## 授權
MIT
