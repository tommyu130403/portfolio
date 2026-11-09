// supabase/functions/guest-admin/index.ts と マイグレーション 20261108120000 の LIKE 条件にも同じ値がある。変えるときは3か所そろえる。
export const GUEST_EMAIL_DOMAIN = "guest.invalid";

export const GUEST_EXPIRED_MESSAGE = "閲覧期限が切れています。オーナーにお問い合わせください";

/** ID だけの入力は予約ドメインのメールアドレスに変換する。"@" を含むものはそのまま使う。 */
export function toLoginEmail(input: string): string {
  // 全角で打たれた英数字・@ も半角にそろえる(IME が全角のままでもログインできるように)。
  const v = input.normalize("NFKC").trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestExpiredError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes("guest_access_expired");
}
