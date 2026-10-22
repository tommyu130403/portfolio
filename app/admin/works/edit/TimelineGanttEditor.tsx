"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { RaciKey, TimelineData, TimelinePhase } from "@/components/WorkViz";
import { FieldLabel, Input, MoveButtons, moveItem } from "../../AdminLayout";
import NumberField from "./NumberField";

// components/WorkViz.tsx:94-99 RACI_STYLE の複製（components/ を触らないため。色を変えるときは両方直す）
const RACI_STYLE: Record<RaciKey, string> = {
  R: "bg-main-100 text-system-900",
  A: "bg-white text-system-900",
  C: "bg-system-600 text-system-900",
  I: "bg-system-800 text-system-500",
};
const RACI_KEYS: RaciKey[] = ["R", "A", "C", "I"];
// components/WorkViz.tsx RACI_LEGEND と同じ文言
const RACI_HINT: Record<RaciKey, string> = {
  R: "Responsible / 実行責任",
  A: "Accountable / 意思決定責任",
  C: "Consulted / 相談先",
  I: "Informed / 報告先",
};
const vizBtn =
  "rounded-[6px] border border-border-light px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-fg-muted";
const vizDel = "rounded px-2 py-1 text-[11px] text-system-700 hover:text-danger-300";
const MAX_UNITS = 104;
const DRAG_THRESHOLD_PX = 4;
const SCROLL_UNITS = 32;
const MIN_COL_PX = 24;

type DragMode = "move" | "resize";
type DragSession = {
  pointerId: number;
  index: number;
  mode: DragMode;
  startX: number;
  colW: number;
  origStart: number;
  origSpan: number;
  start: number;
  span: number;
  moved: boolean;
};
type DragPreview = { index: number; start: number; span: number };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
// 行の React key 用の内部 id（保存形式には含めない）。index を key にすると並べ替えでフォーカスが別の行へ移るため
let keySeq = 0;
const newKey = () => `p${++keySeq}`;

function computeDrag(s: DragSession, clientX: number, totalUnits: number) {
  const delta = Math.round((clientX - s.startX) / s.colW);
  if (s.mode === "move") {
    return { start: clamp(s.origStart + delta, 1, Math.max(1, totalUnits - s.origSpan + 1)), span: s.origSpan };
  }
  return { start: s.origStart, span: clamp(s.origSpan + delta, 1, Math.max(1, totalUnits - s.origStart + 1)) };
}

// components/WorkViz.tsx:107-113 RaciBadge の複製
function RaciBadge({ k }: { k: RaciKey }) {
  return (
    <span className={`flex size-3 shrink-0 items-center justify-center rounded-full ${RACI_STYLE[k]}`}>
      <span className="font-sans text-[8px] font-medium leading-4 [text-box:trim-both_cap_alphabetic]">{k}</span>
    </span>
  );
}

function RaciToggle({ k, pressed, onToggle }: { k: RaciKey; pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={RACI_HINT[k]}
      aria-label={`${k}（${RACI_HINT[k]}）`}
      onClick={onToggle}
      className={`flex size-7 items-center justify-center rounded-full border font-sans text-[11px] font-medium transition-colors ${
        pressed ? `border-transparent ${RACI_STYLE[k]}` : "border-border-light bg-[#1a1a1a] text-system-700 hover:text-white"
      }`}
    >
      {k}
    </button>
  );
}

const phaseSelectClass =
  "!w-56 rounded-[8px] border border-border-light bg-[#1a1a1a] px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary";
const phaseAddButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export default function TimelineGanttEditor({
  value,
  onChange,
  onInsertTemplate,
  phaseNames,
  onAddPhaseName,
}: {
  value: TimelineData;
  onChange: (v: TimelineData) => void;
  onInsertTemplate?: () => void;
  phaseNames: string[];
  onAddPhaseName: (name: string) => Promise<{ error: string | null; name?: string }>;
}) {
  const { totalUnits, phases } = value;
  const [selected, setSelected] = useState<number | null>(null);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [addingPhase, setAddingPhase] = useState(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [keys, setKeys] = useState<string[]>(() => phases.map(newKey));
  // 外部から件数が変わった場合（再読込など）は index で補う
  const rowKey = (i: number) => keys[i] ?? `i${i}`;
  const trackRef = useRef<HTMLDivElement>(null); // 工程行コンテナ（週ヘッダーと同幅）
  const dragRef = useRef<DragSession | null>(null); // ハンドラ内でのみ読み書きする
  const sel = selected !== null && selected < phases.length ? selected : null;
  const minUnits = Math.max(1, ...phases.map((p) => p.start + p.span - 1));
  const maxUnits = Math.max(MAX_UNITS, minUnits, totalUnits);
  const scroll = totalUnits > SCROLL_UNITS;
  const empty = phases.length === 0;
  const patch = (i: number, p: Partial<TimelinePhase>) =>
    onChange({ ...value, phases: phases.map((ph, idx) => (idx === i ? { ...ph, ...p } : ph)) });
  const setUnits = (n: number) => onChange({ ...value, totalUnits: clamp(n, minUnits, maxUnits) });
  const handleAddPhaseName = async (index: number) => {
    if (addingPhase || !newPhaseName.trim()) return;
    setAddingPhase(true);
    setPhaseError(null);
    const res = await onAddPhaseName(newPhaseName);
    if (res.error || !res.name) {
      setPhaseError(res.error ?? "工程名を追加できませんでした");
    } else {
      patch(index, { label: res.name });
      setNewPhaseName("");
    }
    setAddingPhase(false);
  };
  const addPhase = () => {
    onChange({ ...value, phases: [...phases, { label: "", start: 1, span: 2, raci: ["R"] }] });
    setKeys((k) => [...phases.map((_, i) => k[i] ?? `i${i}`), newKey()]);
    setSelected(phases.length);
  };

  const onBarPointerDown = (e: PointerEvent<HTMLDivElement>, i: number) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ph = phases[i];
    const mode: DragMode = (e.target as HTMLElement).closest("[data-resize-handle]") ? "resize" : "move";
    dragRef.current = {
      pointerId: e.pointerId,
      index: i,
      mode,
      startX: e.clientX,
      colW: rect.width / totalUnits,
      origStart: ph.start,
      origSpan: ph.span,
      start: ph.start,
      span: ph.span,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    // preventDefault しない: mousedown でバーにフォーカスを移しキーボード操作を効かせる
  };
  const onBarPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    if (!s.moved && Math.abs(e.clientX - s.startX) < DRAG_THRESHOLD_PX) return;
    // 最初の実移動で基準値を取り直す: pointerdown 直後に数値欄の blur で値が確定していることがある
    const base = s.moved ? s : (() => {
      const ph = phases[s.index];
      const rect = trackRef.current?.getBoundingClientRect();
      return { ...s, origStart: ph.start, origSpan: ph.span, start: ph.start, span: ph.span, colW: rect && rect.width > 0 ? rect.width / totalUnits : s.colW };
    })();
    const next = computeDrag(base, e.clientX, totalUnits);
    if (base.moved && next.start === base.start && next.span === base.span) return;
    dragRef.current = { ...base, moved: true, ...next };
    setPreview({ index: s.index, ...next });
  };
  const onBarPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setPreview(null);
    setSelected(s.index);
    if (s.moved && (s.start !== s.origStart || s.span !== s.origSpan)) patch(s.index, { start: s.start, span: s.span });
  };
  const cancelDrag = (e: PointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setPreview(null);
  };
  const onBarKeyDown = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    if (dragRef.current) return;
    const ph = phases[i];
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(i);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const d = e.key === "ArrowRight" ? 1 : -1;
    setSelected(i);
    if (e.shiftKey) {
      const span = clamp(ph.span + d, 1, Math.max(1, totalUnits - ph.start + 1));
      if (span !== ph.span) patch(i, { span });
    } else {
      const start = clamp(ph.start + d, 1, Math.max(1, totalUnits - ph.span + 1));
      if (start !== ph.start) patch(i, { start });
    }
  };

  const ph = sel !== null ? phases[sel] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel>週数</FieldLabel>
        <span className="font-en text-[13px] font-extrabold text-white">W{totalUnits}</span>
        <NumberField className="w-20" value={totalUnits} min={minUnits} max={maxUnits} disabled={empty} onCommit={setUnits} />
        <span className="text-[11px] text-fg-muted">
          {empty ? "工程を追加すると週数を変更できます" : `一番遅く終わる工程（W${minUnits}）より小さくはできません`}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className={vizBtn} disabled={empty || totalUnits <= minUnits} onClick={() => setUnits(totalUnits - 1)}>
            −1週
          </button>
          <button type="button" className={vizBtn} disabled={empty || totalUnits >= maxUnits} onClick={() => setUnits(totalUnits + 1)}>
            +1週
          </button>
        </span>
      </div>

      <div className={`w-full ${scroll ? "overflow-x-auto" : ""}`}>
        <div
          className="after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] after:border-[rgba(0,0,0,0.1)] relative flex select-none flex-col gap-6 rounded-[14px] px-[25px] pt-[25px] pb-[9px]"
          style={scroll ? { minWidth: totalUnits * MIN_COL_PX + 50 } : undefined}
        >
          <div className="flex flex-col gap-4">
            {/* 週ラベル行 */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${totalUnits}, minmax(0,1fr))` }}>
              {Array.from({ length: totalUnits }, (_, i) => (
                <p key={i} className="font-en text-center text-[11px] font-extrabold leading-6 tracking-[0.55px] text-system-700">
                  W{i + 1}
                </p>
              ))}
            </div>

            {empty ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addPhase}
                  className="flex h-16 w-full items-center justify-center rounded-[12px] border border-dashed border-border-light text-[12px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                >
                  ＋ 工程を追加
                </button>
                {onInsertTemplate && (
                  <button
                    type="button"
                    onClick={onInsertTemplate}
                    className="flex h-16 w-full items-center justify-center rounded-[12px] border border-dashed border-border-light text-[12px] text-fg-muted transition-colors hover:border-primary hover:text-white"
                  >
                    サンプルの工程を入れる（6 工程・12 週）
                  </button>
                )}
              </div>
            ) : (
              <div ref={trackRef} className="isolate flex flex-col gap-2">
                {phases.map((p0, i) => {
                  const dragging = preview?.index === i;
                  const p = dragging ? { ...p0, start: preview.start, span: preview.span } : p0;
                  const end = p.start + p.span - 1;
                  const active = p.raci.includes("R") || p.raci.includes("A");
                  const left = ((p.start - 1) / totalUnits) * 100;
                  const width = (p.span / totalUnits) * 100;
                  return (
                    <div
                      key={rowKey(i)}
                      className={`relative h-6 w-full hover:z-[100]! focus-within:z-[100]! ${dragging ? "z-[100]!" : ""}`}
                      style={{ zIndex: phases.length - i }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={sel === i}
                        aria-label={`${p.label || `工程${i + 1}`}（W${p.start}〜W${end}）`}
                        onPointerDown={(e) => onBarPointerDown(e, i)}
                        onPointerMove={onBarPointerMove}
                        onPointerUp={onBarPointerUp}
                        onPointerCancel={cancelDrag}
                        onLostPointerCapture={cancelDrag}
                        onKeyDown={(e) => onBarKeyDown(e, i)}
                        className={`group after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] absolute top-0 h-6 rounded-[48px] touch-none outline-none ${
                          active ? "bg-main-700 after:border-border-main" : "bg-[rgba(0,0,0,0.25)] after:border-border"
                        } ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
                          sel === i ? "ring-2 ring-primary" : "focus-visible:ring-2 focus-visible:ring-primary/60"
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <span className="flex h-full items-center justify-between gap-1 overflow-hidden rounded-[inherit] py-px pl-[5px] pr-[13px]">
                          <span className="flex shrink-0 items-center gap-1">
                            {p.raci.map((k, ki) => (
                              <RaciBadge key={ki} k={k} />
                            ))}
                          </span>
                          {p.label ? (
                            <span
                              className={`font-en min-w-0 truncate text-[10px] font-extrabold leading-[14px] tracking-[0.4px] ${
                                active ? "text-main-100" : "text-system-500"
                              }`}
                              title={p.label}
                            >
                              {p.label}
                            </span>
                          ) : (
                            <span className="font-en min-w-0 truncate text-[10px] font-extrabold leading-[14px] tracking-[0.4px] text-system-700">
                              工程名未入力
                            </span>
                          )}
                        </span>
                        <span data-resize-handle aria-hidden className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-[48px] hover:bg-white/20" />
                        {dragging && (
                          <span className="pointer-events-none absolute bottom-full left-0 mb-1 whitespace-nowrap rounded-[4px] bg-[#0a0a0a] px-1.5 py-0.5 font-en text-[10px] font-extrabold text-white">
                            W{p.start}–W{end}
                          </span>
                        )}
                        {p.note && (p.note.title || p.note.body) && !preview && (
                          <div
                            className={`pointer-events-none absolute ${left >= 50 ? "right-2" : "left-2"} ${
                              i >= Math.ceil(phases.length / 2) ? "bottom-full mb-1.5" : "top-full mt-1.5"
                            } z-10 hidden w-max max-w-[280px] rounded-[8px] border border-border-light bg-[#0a0a0a] px-3 py-2 group-hover:block`}
                          >
                            {p.note.title && <p className="text-[10px] tracking-[0.3px] text-fg-muted">{p.note.title}</p>}
                            {p.note.body && <p className="text-[12px] leading-[1.5] text-white">{p.note.body}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 凡例 */}
          <div className="flex min-h-[26px] flex-wrap items-center justify-end">
            {RACI_KEYS.map((key) => (
              <span key={key} className="flex items-center gap-2 overflow-clip rounded-r8 px-2 text-[10px] leading-4 tracking-[0.5px] text-system-600">
                <RaciBadge k={key} />
                {RACI_HINT[key]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {sel === null || !ph ? (
        <p className="text-[11px] text-fg-muted">
          バーをクリックすると編集できます。ドラッグで移動、右端のドラッグで期間を変更。キーボード: ←→ で移動、Shift+←→ で期間、Enter で選択
        </p>
      ) : (
        <div key={sel} className="flex flex-col gap-2 rounded-[8px] border border-border-light bg-[#161616] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-2">
              <select
                className={`${phaseSelectClass} ${ph.label ? "text-white" : "text-system-750"}`}
                value={ph.label}
                onChange={(e) => patch(sel, { label: e.target.value })}
              >
                <option value="">（工程名を選択）</option>
                {ph.label && !phaseNames.includes(ph.label) && <option value={ph.label}>{ph.label}（未登録）</option>}
                {phaseNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div
                className="flex items-center gap-2"
                onKeyDown={(e) => {
                  if ((e.target as HTMLElement).tagName !== "INPUT") return;
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                    e.preventDefault();
                    void handleAddPhaseName(sel);
                  }
                }}
              >
                <Input className="!w-44" value={newPhaseName} onChange={setNewPhaseName} placeholder="新しい工程名" />
                <button
                  type="button"
                  className={phaseAddButton}
                  disabled={addingPhase || !newPhaseName.trim()}
                  onClick={() => void handleAddPhaseName(sel)}
                >
                  追加
                </button>
              </div>
              {phaseError && <p className="text-[12px] text-danger-300">{phaseError}</p>}
            </div>
            <span className="ml-auto flex items-center gap-1">
              <MoveButtons
                index={sel}
                length={phases.length}
                label={ph.label || `工程${sel + 1}`}
                onMove={(d) => {
                  onChange({ ...value, phases: moveItem(phases, sel, sel + d) });
                  setKeys((k) => moveItem(phases.map((_, i) => k[i] ?? `i${i}`), sel, sel + d));
                  setSelected(sel + d);
                }}
              />
              <button
                type="button"
                className={vizDel}
                onClick={() => {
                  onChange({ ...value, phases: phases.filter((_, j) => j !== sel) });
                  setKeys((k) => phases.map((_, i) => k[i] ?? `i${i}`).filter((_, j) => j !== sel));
                  setSelected(null);
                }}
              >
                削除
              </button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RACI_KEYS.map((k) => (
              <RaciToggle
                key={k}
                k={k}
                pressed={ph.raci.includes(k)}
                onToggle={() =>
                  patch(sel, { raci: RACI_KEYS.filter((x) => (x === k ? !ph.raci.includes(k) : ph.raci.includes(x))) })
                }
              />
            ))}
            <span className="text-[11px] text-fg-muted">RACI：R＝実行責任 / A＝意思決定責任 / C＝相談先 / I＝報告先</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-fg-muted">開始W</span>
            <NumberField className="w-16" value={ph.start} min={1} max={Math.max(MAX_UNITS, ph.start)} onCommit={(n) => patch(sel, { start: n })} />
            <span className="text-[11px] text-fg-muted">期間</span>
            <NumberField className="w-16" value={ph.span} min={1} max={Math.max(MAX_UNITS, ph.span)} onCommit={(n) => patch(sel, { span: n })} />
            <span className="font-en text-[11px] font-extrabold text-system-700">
              W{ph.start}〜W{ph.start + ph.span - 1}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input className="!w-44" value={ph.note?.title ?? ""} onChange={(v) => patch(sel, { note: { ...ph.note, title: v || undefined } })} placeholder="ツールチップ見出し" />
            <Input value={ph.note?.body ?? ""} onChange={(v) => patch(sel, { note: { ...ph.note, body: v || undefined } })} placeholder="ツールチップ本文" />
          </div>
        </div>
      )}

      <button type="button" className={`${vizBtn} self-start`} onClick={addPhase}>
        ＋ 工程を追加
      </button>
    </div>
  );
}
