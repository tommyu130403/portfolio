"use client";

import { type FC, type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { supabase } from "@/src/lib/supabase";

// 上限は supabase/migrations/20261109130000_contact_messages.sql の check と同じ。片方を変えたら両方直す
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 4000;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Fields = { name: string; email: string; message: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;
type Status = "idle" | "sending" | "sent";

const EMPTY: Fields = { name: "", email: "", message: "" };
// 下書き。背景クリックや Esc で閉じても、開き直せば入力が戻るようにする(送信に成功したら消す)。
// ページを読み込み直すと消える(個人情報をブラウザに残さないため、保存はしない)
let draft: Fields = EMPTY;
/** ログアウト時に呼ぶ(同じタブで次にログインした人へ前の人の入力を見せないため) */
export const clearContactDraft = () => {
  draft = EMPTY;
};

const validate = (f: Fields): FieldErrors => {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = "お名前を入力してください";
  if (!f.email.trim()) errors.email = "返信用メールアドレスを入力してください";
  else if (!EMAIL_PATTERN.test(f.email.trim())) errors.email = "メールアドレスの形式で入力してください（例: name@example.com）";
  if (!f.message.trim()) errors.message = "ご用件を入力してください";
  return errors;
};

// 表は型の作り直し(npm run update-types)前なので、insert だけ型を当てて呼ぶ
type ContactInsertClient = {
  from: (table: "contact_messages") => {
    insert: (row: Fields) => PromiseLike<{ error: { message: string } | null }>;
  };
};

const INPUT_CLASS =
  // スマホは 16px(15px だと iOS Safari が入力時に画面を拡大するため)
  "w-full rounded-[10px] border bg-surface-light px-4 py-3.5 text-[15px] max-md:text-[16px] text-fg outline-none transition-colors focus:border-primary";

type ContactDialogProps = {
  onClose: () => void;
};

/** サイドメニューの Contact とログイン画面から開く問い合わせフォーム。送信内容は Supabase の contact_messages に保存する(ログイン前でも送れる) */
const ContactDialog: FC<ContactDialogProps> = ({ onClose }) => {
  const id = useId();
  const [fields, setFields] = useState<Fields>(draft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState("");
  // 送信に成功するとフォームごと消えるので、操作位置を「閉じる」ボタンへ移す(背面へ抜けないように)
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (status === "sent") closeButtonRef.current?.focus();
  }, [status]);

  const update = (key: keyof Fields) => (value: string) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      draft = next;
      return next;
    });
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length > 0) {
      // 最初の誤りの欄へ移る(画面の読み上げでもどこを直すか分かるように)
      const first = (["name", "email", "message"] as const).find((k) => nextErrors[k]);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const { error } = await (supabase as unknown as ContactInsertClient)
        .from("contact_messages")
        .insert({ name: fields.name.trim(), email: fields.email.trim(), message: fields.message.trim() });
      if (error) {
        setSubmitError(
          error.message.includes("contact_rate_limited")
            ? "送信できる件数の上限に達しました。24時間ほどおいて、もう一度お試しください。"
            : "送信できませんでした。時間をおいて、もう一度お試しください。解決しないときは YOUTRUST のメッセージからご連絡ください。"
        );
        setStatus("idle");
        return;
      }
      draft = EMPTY;
      setStatus("sent");
    } catch {
      setSubmitError("送信できませんでした。通信状況を確かめて、もう一度お試しください。");
      setStatus("idle");
    }
  };

  const fieldProps = (key: keyof Fields) => ({
    id: `${id}-${key}`,
    value: fields[key],
    "aria-required": true,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
    className: `${INPUT_CLASS} ${errors[key] ? "border-danger-300" : "border-border-light"}`,
  });

  const fieldError = (key: keyof Fields) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-[13px] text-danger-300">
        {errors[key]}
      </p>
    ) : null;

  const labelClass = "text-[13px] font-medium text-fg-muted";

  // body 直下に出す。z-[80]: ログイン画面(z-50)・モバイルのメニュー(z-60)・ツールチップ(z-70)より上
  return createPortal(
    <div className="relative z-[80]">
    <Modal onClose={onClose} width="content" ariaLabelledBy={`${id}-title`}>
      <div className="flex w-[480px] max-w-full flex-col gap-6 p-10 max-md:p-6">
        <div className="flex flex-col gap-2">
          <h2
            id={`${id}-title`}
            className="[font-family:var(--font-afacad),var(--font-noto-sans-jp),sans-serif] text-[20px] font-bold leading-[1.5] tracking-[0.05em] text-fg-muted"
          >
            Contact
          </h2>
          {status !== "sent" && (
            <p className="text-[14px] leading-[1.6] text-fg-muted">
              ご用件を送信してください。メールで返信します。
              <br />
              項目はすべて必須です。お名前とメールアドレスは返信のためだけに使います。
            </p>
          )}
        </div>

        {status === "sent" ? (
          <div className="flex flex-col gap-6">
            <p role="status" className="text-[15px] leading-[1.6] text-fg">
              送信しました。お問い合わせありがとうございます。
            </p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-[10px] bg-primary py-3.5 text-[15px] font-semibold text-main-700 transition-opacity hover:opacity-80"
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-name`} className={labelClass}>お名前</label>
              <input
                type="text"
                autoComplete="name"
                maxLength={MAX_NAME}
                onChange={(e) => update("name")(e.target.value)}
                {...fieldProps("name")}
              />
              {fieldError("name")}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-email`} className={labelClass}>返信用メールアドレス</label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={MAX_EMAIL}
                onChange={(e) => update("email")(e.target.value)}
                {...fieldProps("email")}
              />
              {fieldError("email")}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-message`} className={labelClass}>ご用件</label>
              <textarea
                rows={6}
                maxLength={MAX_MESSAGE}
                onChange={(e) => update("message")(e.target.value)}
                {...(() => {
                  const props = fieldProps("message");
                  return { ...props, className: `${props.className} resize-y min-h-[144px] leading-[1.6]` };
                })()}
              />
              {/* 上限に近づいたら残りを出す(貼り付けた長文が黙って切れないように) */}
              {fields.message.length > MAX_MESSAGE - 500 && (
                <p className="text-right text-[12px] text-fg-muted">
                  {fields.message.length} / {MAX_MESSAGE}
                </p>
              )}
              {fieldError("message")}
            </div>
            {submitError && (
              <p role="alert" className="text-[13px] text-danger-300">
                {submitError}
              </p>
            )}
            {/* disabled にすると操作位置が外れるため、送信中は aria-disabled で示し、二重送信は handleSubmit で止める */}
            <button
              type="submit"
              aria-disabled={status === "sending"}
              className="mt-1 rounded-[10px] bg-primary py-3.5 text-[15px] font-semibold text-main-700 transition-opacity hover:opacity-80 aria-disabled:opacity-40"
            >
              {status === "sending" ? "送信中…" : "送信する"}
            </button>
          </form>
        )}
      </div>
    </Modal>
    </div>,
    document.body
  );
};

export default ContactDialog;
