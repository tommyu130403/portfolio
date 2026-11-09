"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { setWorkPublished, saveWorksOrder } from "@/app/admin/actions";
import type { Tables } from "@/src/types/supabase";
import PublishToggle from "./PublishToggle";
import SectionTitle from "./SectionTitle";

// ─── Projects セクション ───────────────────────────────

// from の要素を to の位置へ移し、sort_order を 0..n-1 で振り直す
function reorderWorks(list: Tables<"works">[], from: number, to: number): Tables<"works">[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((w, i) => ({ ...w, sort_order: i }));
}

type PublishFilter = "all" | "published" | "draft";
type SortKey = "order" | "period_desc" | "period_asc" | "created_desc" | "title";

const FILTER_LABELS: { key: PublishFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "published", label: "公開" },
  { key: "draft", label: "非公開" },
];

// null は常に末尾。両方 null のときは 0
function compareNullsLast(a: string | null, b: string | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a === b ? 0 : a < b ? -dir : dir;
}

export default function WorksSection() {
  const [projects, setProjects] = useState<Tables<"works">[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<PublishFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  // 絞り込み中に公開を切り替えた行は、絞り込みを変えるまで一覧に残す（行が消えて詰まり、隣の作品を誤って切り替えないように）
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());

  const changeFilter = (next: PublishFilter) => {
    setFilter(next);
    setKeptIds(new Set());
  };

  const counts = useMemo(() => {
    const published = projects.filter((p) => p.is_published).length;
    return { all: projects.length, published, draft: projects.length - published };
  }, [projects]);

  const visible = useMemo(() => {
    const filtered =
      filter === "all"
        ? projects
        : projects.filter((p) => keptIds.has(p.id) || p.is_published === (filter === "published"));
    const list = [...filtered];
    switch (sortKey) {
      case "period_desc":
        return list.sort((a, b) => compareNullsLast(a.start_date, b.start_date, -1) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
      case "period_asc":
        return list.sort((a, b) => compareNullsLast(a.start_date, b.start_date, 1) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
      case "created_desc":
        return list.sort((a, b) => compareNullsLast(a.created_at, b.created_at, -1));
      case "title":
        return list.sort((a, b) => a.title.localeCompare(b.title, "ja", { numeric: true }));
      default:
        return list;
    }
  }, [projects, filter, sortKey, keptIds]);

  const canReorder = filter === "all" && sortKey === "order";

  const reloadProjects = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("works")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data) return false;
    setProjects(data);
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    supabase
      .from("works")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (data) setProjects(data);
        if (error) setLoadError(error.message);
        setFetching(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 公開状態は即時に画面へ反映し、保存に失敗したらその行だけ元へ戻す
  const handleTogglePublished = async (id: string, next: boolean) => {
    const setRow = (value: boolean) =>
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, is_published: value } : p)));
    setRow(next);
    setPendingIds((prev) => new Set(prev).add(id));
    if (filter !== "all") setKeptIds((prev) => new Set(prev).add(id));
    setToggleError(null);
    const { error } = await setWorkPublished(id, next);
    if (error) {
      setRow(!next);
      setToggleError(error);
    }
    setPendingIds((prev) => {
      const rest = new Set(prev);
      rest.delete(id);
      return rest;
    });
  };

  // 公開切替の保存中、または並び替えの保存中は、お互いの操作を止める
  const reorderLocked = savingOrder || pendingIds.size > 0;

  // 並び順は即時に画面へ反映する。失敗したら DB の最新の並びを読み直す（一部の行だけ保存された場合に画面とズレないように）
  const applyOrder = async (from: number, to: number) => {
    if (!canReorder || reorderLocked || from === to || to < 0 || to >= projects.length) return;
    const next = reorderWorks(projects, from, to);
    const updates = next
      .map(({ id }, i) => ({ id, sort_order: i }))
      .filter(({ id, sort_order }) => projects.find((p) => p.id === id)?.sort_order !== sort_order);
    if (updates.length === 0) return;
    setProjects(next);
    setSavingOrder(true);
    setOrderError(null);
    const { error } = await saveWorksOrder(updates);
    if (error) {
      const reloaded = await reloadProjects();
      setOrderError(
        reloaded
          ? `${error}（最新の状態を読み込み直しました）`
          : `${error}（最新の状態を読み込めませんでした。ページを再読み込みしてください）`,
      );
    }
    setSavingOrder(false);
  };

  const clearDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  if (fetching) return <div className="h-64 animate-pulse rounded-[12px] bg-[#1a1a1a]" />;
  if (loadError) return <p className="text-[13px] text-danger-300" role="alert">作品を読み込めませんでした: {loadError}</p>;

  return (
    <section id="works" className="scroll-mt-8">
      <SectionTitle label="Works" title="制作・企画" />
      <p className="mb-6 text-[13px] text-fg-muted">
        各プロジェクトは専用の編集ページ（本文エディタ + 設定）で管理します。右のスイッチで公開 / 非公開を切り替えられます（すぐに反映されます）。「すべて」「表示順」のときはドラッグまたは ↑↓ で並び順を変更できます（すぐに反映されます）。
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="公開状態で絞り込み" className="inline-flex rounded-[8px] border border-border-light bg-[#161616] p-0.5">
          {FILTER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => changeFilter(key)}
              className={`rounded-[6px] px-3 py-1.5 text-[12px] transition-colors ${
                filter === key ? "bg-primary/20 text-white" : "text-fg-muted hover:text-white"
              }`}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[12px] text-fg-muted">並び順</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-[8px] border border-border-light bg-[#161616] px-3 py-1.5 text-[12px] text-white"
          >
            <option value="order">表示順（公開サイトの順）</option>
            <option value="period_desc">期間が新しい順</option>
            <option value="period_asc">期間が古い順</option>
            <option value="created_desc">追加が新しい順</option>
            <option value="title">タイトル順</option>
          </select>
        </label>
      </div>
      {!canReorder && (
        <p className="mb-3 text-[12px] text-fg-muted">並び順の変更は「すべて」かつ「表示順」のときだけできます。</p>
      )}
      {toggleError && <p className="mb-3 text-[12px] text-danger-300">公開状態の更新に失敗しました: {toggleError}</p>}
      {orderError && <p className="mb-3 text-[12px] text-danger-300">並び順の保存に失敗しました: {orderError}</p>}
      <div className="mb-6 flex flex-col gap-3">
        {visible.map((project, idx) => (
          <div
            key={project.id}
            draggable={canReorder && !reorderLocked}
            onDragStart={(e) => {
              if (!canReorder) return;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("application/x-work-id", project.id);
              setDragIndex(idx);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overIndex !== idx) setOverIndex(idx);
            }}
            onDragLeave={() => {
              if (overIndex === idx) setOverIndex(null);
            }}
            onDragEnd={clearDrag}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndex;
              clearDrag();
              if (from !== null) void applyOrder(from, idx);
            }}
            className={`flex items-center justify-between gap-4 rounded-[12px] border bg-[#161616] px-5 py-4 transition-colors hover:border-primary ${
              overIndex === idx && dragIndex !== null && dragIndex !== idx ? "border-primary" : "border-border-light"
            } ${dragIndex === idx ? "opacity-50" : ""}`}
          >
            {canReorder && (
              <span aria-hidden="true" className="shrink-0 cursor-grab select-none text-[14px] leading-none text-system-700">⋮⋮</span>
            )}
            <Link href={`/admin/works/edit?id=${project.id}`} draggable={false} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="shrink-0 text-[12px] font-medium text-primary">{project.category ?? "—"}</span>
              <span className={`truncate text-[14px] ${project.is_published ? "text-white" : "text-fg-muted"}`}>{project.title}</span>
            </Link>
            <PublishToggle
              checked={project.is_published}
              disabled={pendingIds.has(project.id) || savingOrder}
              label={project.title}
              title="オフにすると公開サイトの一覧・詳細・経歴リンクに出ません（すぐに反映されます）"
              onChange={(next) => handleTogglePublished(project.id, next)}
            />
            {canReorder && (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (idx === 0 || reorderLocked) return;
                    void applyOrder(idx, idx - 1);
                  }}
                  aria-disabled={idx === 0 || reorderLocked}
                  aria-label={`${project.title} を上へ`}
                  className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:text-system-700"
                >↑</button>
                <button
                  type="button"
                  onClick={() => {
                    if (idx === visible.length - 1 || reorderLocked) return;
                    void applyOrder(idx, idx + 1);
                  }}
                  aria-disabled={idx === visible.length - 1 || reorderLocked}
                  aria-label={`${project.title} を下へ`}
                  className="rounded px-2 py-1 text-[12px] text-system-700 hover:text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:text-system-700"
                >↓</button>
              </div>
            )}
            <Link href={`/admin/works/edit?id=${project.id}`} draggable={false} className="shrink-0 text-[12px] text-system-700">
              編集 →
            </Link>
          </div>
        ))}
        {projects.length === 0 ? (
          <p className="text-[13px] text-system-700">プロジェクトがありません</p>
        ) : (
          visible.length === 0 && <p className="text-[13px] text-system-700">条件に合う作品がありません</p>
        )}
      </div>
      <Link
        href="/admin/works/edit?id=new"
        className="block w-full rounded-[12px] border border-dashed border-border-light py-4 text-center text-[14px] text-system-700 transition-colors hover:border-primary hover:text-white"
      >
        ＋ プロジェクトを追加
      </Link>
    </section>
  );
}
