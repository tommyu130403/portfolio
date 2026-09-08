#!/bin/sh
# close-gate.sh — Stop hook。「閉じの門」。リポジトリ同梱版（クラウドセッションでも効かせるため）。
#
# 最後の応答が `**完了**` / `**次のアクション**` で閉じているか、AskUserQuestion で
# 終わっているかを判定し、どちらでもなければ exit 2 + stderr で停止を差し戻す。
#
# 設計方針:
# - 判定できないとき（transcript_path 無し・読めない・応答が空）は通す（fail-open）。
#   門の目的は「忘れ」を拾うことで、ハーネス障害時に全ターンを止めることではない。
#   代わりに <一時ディレクトリ>/claude-close-gate/close-gate.log に記録し、後から観測できるようにする。
# - 無限ループ防止: stop_hook_active を尊重 + 同一セッションで3回連続ブロックしたら通す。
# - 判定するのは「最後の user エントリ以降の assistant 出力」だけ。ターン途中のツール呼び出しは見ない。

INPUT=$(cat)
command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | python3 -c '
import sys, json, re, os, tempfile
inp = json.load(sys.stdin)
if inp.get("stop_hook_active"):
    sys.exit(0)
state_dir = os.path.join(tempfile.gettempdir(), "claude-close-gate")
os.makedirs(state_dir, exist_ok=True)
log = open(os.path.join(state_dir, "close-gate.log"), "a", encoding="utf-8")
sid = inp.get("session_id") or "nosession"
sf = os.path.join(state_dir, "close-" + re.sub(r"[^A-Za-z0-9_-]", "_", sid))
def passthrough(reason):
    try: os.remove(sf)
    except Exception: pass
    log.write(f"{sid} pass: {reason}\n")
    sys.exit(0)
tp = inp.get("transcript_path")
if not tp or not os.path.isfile(tp):
    passthrough(f"no transcript_path ({tp})")
run = []
with open(tp, encoding="utf-8") as f:
    for line in f:
        try: d = json.loads(line)
        except Exception: continue
        t = d.get("type")
        if t == "user":
            run = []
        elif t == "assistant" and not d.get("isSidechain"):
            run.append(d)
texts = []; asked = False
for d in run:
    for b in d.get("message", {}).get("content", []) or []:
        if not isinstance(b, dict): continue
        if b.get("type") == "text": texts.append(b.get("text", ""))
        elif b.get("type") == "tool_use" and b.get("name") == "AskUserQuestion": asked = True
final = "\n".join(texts).strip()
if asked: passthrough("AskUserQuestion")
if not final: passthrough("empty response")
if re.search(r"\*\*(完了|次のアクション)\*\*", final[-800:]):
    passthrough("closed")
n = 0
try: n = int(open(sf).read().strip() or 0)
except Exception: pass
if n >= 3:
    passthrough("3 consecutive blocks")
open(sf, "w").write(str(n + 1))
log.write(f"{sid} block #{n + 1}\n")
sys.stderr.write(
  "閉じの門(§5-1): 最後の応答が `**完了**` / `**次のアクション**` で閉じていません。"
  "判断がユーザーの手にあるなら AskUserQuestion で1問だけ聞く。そうでなければ末尾に "
  "`**完了**`（何が終わったか1行）か `**次のアクション**`（誰が何をするか1つ）を付けて閉じ直してください。\n")
sys.exit(2)
'
