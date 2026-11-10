"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import SectionTitle from "../SectionTitle";

const smallButton =
  "shrink-0 rounded-[6px] border border-border-light px-3 py-1 text-[11px] text-fg-muted transition-colors hover:border-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-system-700 hover:bg-danger-300/10 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-40";

type GuestRow = {
  user_id: string;
  login_id: string;
  created_at: string;
  expires_at: string | null;
  last_sign_in_at: string | null;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type FunctionsError = { message: string; context?: { json?: () => Promise<unknown> } };

// The generated DB types are refreshed only after the migration is applied.
const client = supabase as unknown as {
  rpc: {
    (name: "owner_list_guests"): RpcResult<GuestRow[]>;
    (name: "owner_stop_guest", args: { p_user_id: string }): RpcResult<null>;
  };
  functions: {
    invoke: (
      name: "guest-admin",
      options: { body: { action: "issue" | "reset-password" } },
    ) => Promise<{ data: unknown; error: FunctionsError | null }>;
  };
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function isExpired(row: GuestRow): boolean {
  return row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now();
}

function statusOf(row: GuestRow): string {
  if (row.expires_at === null) return "無期限";
  return isExpired(row) ? "期限切れ" : "有効";
}

async function describeInvokeError(error: FunctionsError): Promise<string> {
  try {
    const body = (await error.context?.json?.()) as { error?: string; detail?: string } | undefined;
    if (body?.error) return body.detail ? `${body.error}: ${body.detail}` : body.error;
  } catch {
    // 本文が JSON でなければ message をそのまま使う
  }
  return error.message;
}

async function copyWithClipboardApi(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export default function GuestsSection() {
  const issuedIdRef = useRef<HTMLSpanElement>(null);
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ loginId: string; expiresAt: string } | null>(null);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetResult, setResetResult] = useState<{ updated: number; failed: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await client.rpc("owner_list_guests");
      if (error) {
        setListError(error.message);
        return;
      }
      setListError("");
      setRows(data ?? []);
    } catch {
      setListError("一覧を取得できませんでした");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleIssue = async () => {
    setBusy(true);
    setActionError("");
    setIssued(null);
    setCopied(false);
    try {
      const { data, error } = await client.functions.invoke("guest-admin", { body: { action: "issue" } });
      if (error) {
        setActionError(await describeInvokeError(error));
        return;
      }
      const res = data as { loginId?: string; expiresAt?: string } | null;
      if (!res?.loginId || !res.expiresAt) {
        setActionError("発行結果を読み取れませんでした");
        return;
      }
      setIssued({ loginId: res.loginId, expiresAt: res.expiresAt });
      await load();
    } catch {
      setActionError("発行できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const selectIssuedId = () => {
    const node = issuedIdRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleCopy = async () => {
    if (!issued) return;
    setActionError("");
    setCopied(false);
    // 埋め込みブラウザ（Claude アプリ内など）はクリップボード API の書き込みを拒否するため、旧方式で写す
    const ok = (await copyWithClipboardApi(issued.loginId)) || copyWithExecCommand(issued.loginId);
    if (ok) {
      setCopied(true);
      return;
    }
    selectIssuedId();
    setActionError("コピーできませんでした。IDを選択したので、⌘C（Ctrl+C）で写してください");
  };

  const handleStop = async (userId: string) => {
    if (confirmStopId !== userId) {
      setConfirmStopId(userId);
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const { error } = await client.rpc("owner_stop_guest", { p_user_id: userId });
      if (error) {
        setActionError(`止められませんでした（${error.message}）。もう一度お試しください`);
        return;
      }
      setConfirmStopId(null);
      await load();
    } catch {
      setActionError("止められませんでした");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setBusy(true);
    setActionError("");
    setResetResult(null);
    try {
      const { data, error } = await client.functions.invoke("guest-admin", { body: { action: "reset-password" } });
      if (error) {
        setActionError(await describeInvokeError(error));
        return;
      }
      const res = data as { updated?: number; failed?: number } | null;
      setResetResult({ updated: res?.updated ?? 0, failed: res?.failed ?? 0 });
    } catch {
      setActionError("再設定できませんでした");
    } finally {
      setConfirmReset(false);
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle label="Guests" title="ゲストID" />

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void handleIssue()} disabled={busy} className={smallButton}>
          ゲストIDを発行
        </button>
        <p className="text-[12px] text-fg-muted">発行から30日間ログインできます</p>
      </div>

      {issued && (
        <div className="mt-4 rounded-[8px] border border-primary/40 bg-surface p-4">
          <p className="text-[11px] text-fg-muted">発行したID（共通パスワードと一緒に渡してください）</p>
          <div className="mt-2 flex items-center gap-3">
            <span ref={issuedIdRef} className="select-all font-mono text-[20px] tracking-[1px] text-white">{issued.loginId}</span>
            <button type="button" onClick={() => void handleCopy()} className={smallButton}>
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-fg-muted">期限: {formatDate(issued.expiresAt)}</p>
        </div>
      )}

      {actionError && (
        <p className="mt-3 text-[13px] text-danger-300" role="alert">{actionError}</p>
      )}

      <div className="mt-10">
        <p className="text-[14px] text-white">発行済みのID</p>
        {listError && <p className="mt-2 text-[13px] text-danger-300" role="alert">{listError}</p>}
        <div className="mt-3 overflow-x-auto rounded-[8px] border border-border-light">
          <table className="w-full text-left text-[13px] text-white">
            <thead>
              <tr className="border-b border-border-light text-[11px] text-fg-muted">
                <th className="px-3 py-2 font-normal">ID</th>
                <th className="px-3 py-2 font-normal">発行日</th>
                <th className="px-3 py-2 font-normal">期限</th>
                <th className="px-3 py-2 font-normal">最終ログイン</th>
                <th className="px-3 py-2 font-normal">状態</th>
                <th className="px-3 py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-[12px] text-fg-muted">発行済みのIDはありません</td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.user_id} className="border-b border-border-light last:border-b-0">
                  <td className="px-3 py-2 font-mono">{row.login_id}</td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">{row.expires_at ? formatDate(row.expires_at) : "無期限"}</td>
                  <td className="px-3 py-2">{row.last_sign_in_at ? formatDate(row.last_sign_in_at) : "未ログイン"}</td>
                  <td className="px-3 py-2">{statusOf(row)}</td>
                  <td className="px-3 py-2 text-right">
                    {!isExpired(row) && (
                      <button
                        type="button"
                        onClick={() => void handleStop(row.user_id)}
                        disabled={busy}
                        className={confirmStopId === row.user_id ? dangerButton : smallButton}
                      >
                        {confirmStopId === row.user_id ? "本当に止める" : "今すぐ止める"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <p className="text-[14px] text-white">共通パスワードの再設定</p>
        <p className="mt-2 text-[12px] text-fg-muted">
          先に新しいパスワードを Edge Function のシークレット GUEST_SHARED_PASSWORD に設定してから実行してください。
          期限内のゲストID（メールアドレス型のIDは除く）に新しいパスワードを反映します。
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={busy}
            className={confirmReset ? dangerButton : smallButton}
          >
            {confirmReset ? "本当に再設定する" : "共通パスワードを反映"}
          </button>
          {confirmReset && (
            <button type="button" onClick={() => setConfirmReset(false)} disabled={busy} className={smallButton}>
              やめる
            </button>
          )}
          {resetResult && (
            <p className="text-[12px] text-fg-muted">
              更新 {resetResult.updated} 件 / 失敗 {resetResult.failed} 件
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
