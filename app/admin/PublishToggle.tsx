"use client";

/**
 * 公開 / 非公開を切り替えるスイッチ（Works 一覧・編集ヘッダー共通）。
 * 状態の保存は呼び出し側が行う。ここは見た目とクリックの通知だけを担当する。
 */
export default function PublishToggle({
  checked,
  onChange,
  disabled,
  label,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? `${label} の公開状態` : "公開状態"}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex shrink-0 items-center gap-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "border border-border-light bg-[#2a2a2a]"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-[#f5f5f5] transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
      <span className={`text-[12px] ${checked ? "text-primary" : "text-fg-muted"}`}>
        {checked ? "公開" : "非公開"}
      </span>
    </button>
  );
}
