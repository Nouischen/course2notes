# 轉逐字稿。自動偵測 GPU：有 → 本機 faster-whisper large-v3（免費）；無 → 提示改用 --api（需 OPENAI_API_KEY）。
# 用法（Mac/Linux 用 python3）：
#   本機/自動： python transcribe.py <audio_dir> <transcript_dir>
#   強制 API ： python transcribe.py <audio_dir> <transcript_dir> --api
import os, sys, json, glob, re

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

if len(sys.argv) < 3:
    print("用法: python transcribe.py <audio_dir> <transcript_dir> [--api]（Mac/Linux 用 python3）", flush=True); sys.exit(2)
AUD, TR = sys.argv[1], sys.argv[2]
USE_API = "--api" in sys.argv[3:]
os.makedirs(TR, exist_ok=True)
LANG = os.environ.get("COURSE2NOTES_LANG") or None  # 預設 None＝Whisper 自動偵測語言；設了才強制該語言
_CJK = re.compile(r"[぀-ヿ㐀-鿿豈-﫿가-힯]")
def sep_for(lang, text=""):
    # CJK / 日 / 韓 段落間不加空白；其餘語言用空白。lang 未知（自動偵測）時，用文字內容推斷。
    if lang:
        return "" if lang.lower().startswith(("zh", "ja", "ko", "yue")) else " "
    return "" if _CJK.search(text or "") else " "

exts = ("*.m4a", "*.mp4", "*.webm", "*.aac", "*.mp3", "*.wav")
files = sorted({f for e in exts for f in glob.glob(os.path.join(AUD, e))})
jobs = [(f, os.path.join(TR, os.path.splitext(os.path.basename(f))[0])) for f in files
        if not (os.path.exists(os.path.join(TR, os.path.splitext(os.path.basename(f))[0] + ".fulltext.txt")))]
print(f"[plan] 待轉錄 {len(jobs)} / 共 {len(files)}", flush=True)
if not files:
    print("[ERR] 音訊資料夾沒有任何音檔可轉錄（下載步驟可能失敗了，請先檢查 download 結果）。", flush=True); sys.exit(3)
if not jobs:
    print("[ALLDONE] 無待處理（全部已完成）"); sys.exit(0)

def has_gpu():
    try:
        import ctypes
        for dll in ("nvcuda.dll", "libcuda.so", "libcuda.so.1"):
            try: ctypes.CDLL(dll); return True
            except Exception: pass
    except Exception:
        pass
    return False

# ---- API 路徑（無 GPU 或 --api）----
if USE_API or not has_gpu():
    if not USE_API:
        print("[model] 未偵測到 GPU。", flush=True)
    if not os.environ.get("OPENAI_API_KEY"):
        print("[需要] 沒有 GPU 就要用 API 轉錄：請設定環境變數 OPENAI_API_KEY 後重跑（約 US$0.006/分鐘），"
              "或改在有 NVIDIA GPU 的電腦上跑。", flush=True)
        sys.exit(2)
    try:
        from openai import OpenAI
    except Exception:
        print("[需要] 請先 pip install openai", flush=True); sys.exit(2)
    import subprocess, tempfile, shutil
    MAX_API_BYTES = 24 * 1024 * 1024  # whisper-1 上限 25MB，留安全邊界

    def _ff(args):
        try:
            return subprocess.run(["ffmpeg", "-nostdin", "-y", *args], capture_output=True)
        except FileNotFoundError:
            return None

    def api_one(client, path_in):
        with open(path_in, "rb") as fh:
            kw = {"language": LANG} if LANG else {}  # 沒指定語言就讓 Whisper 自動偵測
            return client.audio.transcriptions.create(model="whisper-1", file=fh, **kw).text

    def api_transcribe(client, audio):
        # 先壓成 16k 單聲道低位元率（whisper 只需這樣），順便大幅縮小體積 → 多數課程一次就送得出去
        tmpd = tempfile.mkdtemp(prefix="c2n_")
        try:
            comp = os.path.join(tmpd, "a.m4a")
            r = _ff(["-i", audio, "-ac", "1", "-ar", "16000", "-b:a", "32k", comp])
            src = comp if (r is not None and r.returncode == 0 and os.path.exists(comp)) else audio
            if os.path.getsize(src) <= MAX_API_BYTES:
                return api_one(client, src)
            # 仍超過上限（超長課程）→ 用 ffmpeg 切成約 10 分鐘一段，分批送再拼接
            seg = os.path.join(tmpd, "seg_%03d.m4a")
            _ff(["-i", src, "-f", "segment", "-segment_time", "600", "-c", "copy", seg])
            parts = sorted(glob.glob(os.path.join(tmpd, "seg_*.m4a"))) or [src]
            texts = [api_one(client, p) for p in parts]
            return sep_for(LANG, "".join(texts)).join(texts)
        finally:
            shutil.rmtree(tmpd, ignore_errors=True)

    client = OpenAI()
    print("[model] OpenAI Whisper API（注意：音檔會上傳到 OpenAI 進行轉錄）", flush=True)
    fails = []
    for audio, base in jobs:
        name = os.path.basename(base)
        print(f"[job] {os.path.basename(audio)} -> {name} (API)", flush=True)
        try:
            text = api_transcribe(client, audio)
            open(base + ".fulltext.txt", "w", encoding="utf-8").write(text)
            print(f"[done] {name}", flush=True)
        except Exception as e:
            fails.append(name); print(f"[ERR] {name}: {e}", flush=True)
    if fails:
        print(f"[WARN] {len(fails)} 個單元轉錄失敗（未產生逐字稿）：{', '.join(fails)}", flush=True)
        print("[ALLDONE]", flush=True); sys.exit(1)
    print("[ALLDONE]", flush=True); sys.exit(0)

# ---- 本機 faster-whisper 路徑 ----
# 若使用 whisper-work venv 的 nvidia dll，可在此加入 os.add_dll_directory(...)
try:
    from faster_whisper import WhisperModel
except Exception:
    print("[需要] 偵測到 GPU 但未安裝 faster-whisper。請 pip install -U faster-whisper "
          "nvidia-cudnn-cu12 nvidia-cublas-cu12（Mac/Linux 用 pip3），或改用 --api。", flush=True)
    sys.exit(2)

PRIMER = os.environ.get("COURSE2NOTES_PRIMER",
    "以下是一場線上課程或講座的錄音，內容為專業知識講解。")

def ts(s):
    h=int(s//3600); m=int((s%3600)//60); s=int(s%60); return f"{h:02d}:{m:02d}:{s:02d}"

try:
    model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    print("[model] large-v3 CUDA int8_float16", flush=True)
except Exception as e:
    if os.environ.get("COURSE2NOTES_ALLOW_CPU"):
        print(f"[model] CUDA 失敗({e})，改用 CPU（large-v3 在 CPU 上非常慢）", flush=True)
        model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    else:
        print(f"[需要] CUDA 初始化失敗({e})。若是 'Unable to load libcudnn/libcublas' 這類，"
              "多半缺 CUDA 執行期：pip install -U nvidia-cudnn-cu12 nvidia-cublas-cu12 後重跑。"
              "large-v3 在 CPU 上會非常慢，也可改用 --api；若真的要用 CPU，設 COURSE2NOTES_ALLOW_CPU=1 再重跑。", flush=True)
        sys.exit(2)

fails = []
for audio, base in jobs:
    name = os.path.basename(base)
    print(f"[job] {os.path.basename(audio)} -> {name}", flush=True)
    try:
        segments, info = model.transcribe(audio, language=LANG, beam_size=5, vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500), condition_on_previous_text=False,
            repetition_penalty=1.1, no_repeat_ngram_size=3, initial_prompt=PRIMER,
            temperature=[0.0,0.2,0.4], compression_ratio_threshold=2.4, no_speech_threshold=0.6)
        total = info.duration or 1; rows=[]; last=-5
        tf = open(base + ".timestamped.txt", "w", encoding="utf-8")
        for seg in segments:
            t = seg.text.strip(); rows.append({"start":seg.start,"end":seg.end,"text":t})
            tf.write(f"[{ts(seg.start)}] {t}\n"); tf.flush()
            pct=int(seg.end/total*100)
            if pct>=last+10: last=pct; print(f"  {name} ...{pct}%", flush=True)
        tf.close()
        json.dump(rows, open(base+".json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
        texts = [r["text"] for r in rows]
        sep = sep_for(getattr(info, "language", None) or LANG, "".join(texts))
        open(base+".fulltext.txt","w",encoding="utf-8").write(sep.join(texts))
        print(f"[done] {name}: {len(rows)} segments", flush=True)
    except Exception as e:
        fails.append(name); print(f"[ERR] {name}: {e}", flush=True)
if fails:
    print(f"[WARN] {len(fails)} 個單元轉錄失敗（未產生逐字稿）：{', '.join(fails)}", flush=True)
    print("[ALLDONE]", flush=True); sys.exit(1)
print("[ALLDONE]", flush=True); sys.exit(0)
