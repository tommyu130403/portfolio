/**
 * ホバーで反応するカードの共通インタラクション（Figma Library Card Status=hover）。
 * 背景 Action/hover・影 shadow を 300ms ease-out で付ける。枠の色は各カードの枠の持ち方
 * （border か ::after）に合わせて `hover:border-border-light` / `hover:after:border-border-light` を足す。
 * 影が隣のカードの下に隠れないようホバー中は1段手前に出し、外したときは影が消え終わる
 * 300ms 後に奥へ戻す（z-index が auto だと遅延が効かないため通常時を 0 と明示する）。
 */
export const HOVER_CARD =
  "z-0 hover:z-[1] hover:bg-action-hover hover:shadow-base [transition:background-color_300ms_ease-out,border-color_300ms_ease-out,box-shadow_300ms_ease-out,z-index_0s_linear_300ms] hover:[transition-delay:0s] after:transition-colors after:duration-300 after:ease-out motion-reduce:transition-none motion-reduce:after:transition-none";
