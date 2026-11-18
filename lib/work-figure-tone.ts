// 作品の図版（WorkFigure 系）の色と線の決まり。
// ミントは広い面の塗りに使わない。danger は塗りに使わない（線と文字のみ）。
export const WORK_FIGURE_TONE = Object.freeze({
  frame: "border border-border rounded-r8",
  cell: "bg-surface-light rounded-r8",
  accent: "border border-border-main text-main-050",
  stepMark: "border-t-2 border-primary",
  dotSelf: "bg-primary",
  // ほかのメンバーの印は中抜きの丸（自分=塗り と色だけでなく形でも見分ける）。線は fg-muted で背景 surface-light に対し 5.9:1
  dotOther: "ring-[1.5px] ring-inset ring-fg-muted",
  barPlan: "bg-border-light",
  barActual: "bg-primary",
  blocked: "border border-dashed border-danger-200 text-danger-100",
  deferred: "border border-dashed border-border-light",
  cut: "border border-border-light text-fg-muted line-through",
});
