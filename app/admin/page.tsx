import { redirect } from "next/navigation";

/** /admin は最初のセクション（Profile）の専用ページへリダイレクトする */
export default function AdminIndexPage() {
  redirect("/admin/profile");
}
