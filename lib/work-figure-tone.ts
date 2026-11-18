// 作品の図版（WorkFigure 系）の色と線の決まり。
// ミントは広い面の塗りに使わない。danger は塗りに使わない（線と文字のみ）。
export const WORK_FIGURE_TONE = Object.freeze({
  frame: "border border-border rounded-r8",
  cell: "bg-surface-light rounded-r8",
  accent: "border border-border-main text-main-050",
  stepMark: "border-t-2 border-primary",
  dotSelf: "bg-primary",
  dotOther: "bg-fg-caption",
  barPlan: "bg-border-light",
  barActual: "bg-primary",
  blocked: "border border-dashed border-danger-200 text-danger-100",
  deferred: "border border-dashed border-border-light",
  cut: "border border-border-light text-fg-muted line-through",
});
