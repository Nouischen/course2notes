# 轉逐字稿。自動偵測 GPU：有 → 本機 faster-whisper large-v3（免費）；無 → 提示改用 --api（需 OPENAI_API_KEY）。
# 用法：
#   本機/自動： python transcribe.py <audio_dir> <transcript_dir>
#   強制 API ： python transcribe.py <audio_dir> <transcript_dir> --api
import os, sys, json, glob

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

AUD, TR = sys.argv[1], sys.argv[2]
USE_API = "--api" in sys.argv[3:]
os.makedirs(TR, exist_ok=True)
LANG = os.environ.get("COURSE2NOTES_LANG", "zh")

exts = ("*.m4a", "*.mp4", "*.webm", "*.aac", "*.mp3", "*.wav")
files = sorted({f for e in exts for f in glob.glob(os.path.join(AUD, e))})
jobs = [(f, os.path.join(TR, os.path.splitext(os.path.basename(f))[0])) for f in files
        if not (os.path.exists(os.path.join(TR, os.path.splitext(os.path.basename(f))[0] + ".fulltext.txt")))]
print(f"[plan] 待轉錄 {len(jobs)} / 共 {len(files)}", flush=True)
if not jobs:
    print("[ALLDONE] 無待處理"); sys.exit(0)

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
    client = OpenAI()
    print("[model] OpenAI Whisper API", flush=True)
    for audio, base in jobs:
        name = os.path.basename(base)
        print(f"[job] {os.path.basename(audio)} -> {name} (API)", flush=True)
        try:
            with open(audio, "rb") as fh:
                tr = client.audio.transcriptions.create(model="whisper-1", file=fh, language=LANG)
            open(base + ".fulltext.txt", "w", encoding="utf-8").write(tr.text)
            print(f"[done] {name}", flush=True)
        except Exception as e:
            print(f"[ERR] {name}: {e}", flush=True)
    print("[ALLDONE]", flush=True); sys.exit(0)

# ---- 本機 faster-whisper 路徑 ----
# 若使用 whisper-work venv 的 nvidia dll，可在此加入 os.add_dll_directory(...)
from faster_whisper import WhisperModel

PRIMER = os.environ.get("COURSE2NOTES_PRIMER",
    "以下是一場線上課程或講座的錄音，內容為專業知識講解。")

def ts(s):
    h=int(s//3600); m=int((s%3600)//60); s=int(s%60); return f"{h:02d}:{m:02d}:{s:02d}"

try:
    model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    print("[model] large-v3 CUDA int8_float16", flush=True)
except Exception as e:
    print(f"[model] CUDA 失敗({e})，改 CPU（會慢）", flush=True)
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")

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
        open(base+".fulltext.txt","w",encoding="utf-8").write("".join(r["text"] for r in rows))
        print(f"[done] {name}: {len(rows)} segments", flush=True)
    except Exception as e:
        print(f"[ERR] {name}: {e}", flush=True)
print("[ALLDONE]", flush=True)
