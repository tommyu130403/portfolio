"use client";

import { type FC, type ReactNode, useMemo, useState } from "react";
import Icon from "./Icon";
import Tag from "./Tag";
import Tooltip from "./Tooltip";
import { resolveLogoSlug } from "@/src/components/SkillsCardGrid";
import WorkVizModal from "./WorkVizModal";
import ProtectedImage from "./ProtectedImage";
import { LaptopMock, PhoneMock, ScreenshotLightbox } from "./DeviceMock";
import { parseTimeline, parseStakeholders } from "./WorkViz";
import { EditButton } from "./WorkMarkdown";
import { parseHeroLayout, parseHeroSlots, type HeroLayout } from "@/lib/work-content";
import { periodFromRow } from "@/lib/timeline-scale";
import type { Tables } from "@/src/types/supabase";

type Work = Tables<"works">;

export type WorkToolItem = { name: string; icon_url: string | null; slug?: string | null };

/**
 * 画像の縦横を調べる 1px の見えない画像（ProtectedImage は画面内に入ったときだけ署名・読み込みをするので、display:none にはできない）。
 * 読めない（404・署名失敗・権限なし）ときは縦長扱いで確定させ、従来どおりスマホ枠（壊れた画像の表示）を出す — ヒーローを消さない
 */
const OrientationProbe: FC<{ src: string; onResult: (landscape: boolean) => void }> = ({ src, onResult }) => (
  <div className="relative h-px w-px overflow-hidden">
    <ProtectedImage
      src={src}
      alt=""
      className="absolute left-0 top-0 h-px w-px opacity-0"
      onLoad={(e) => onResult(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)}
      onError={() => onResult(false)}
      onUnavailableChange={(unavailable) => unavailable && onResult(false)}
    />
  </div>
);

/**
 * ヒーロー画像の読込み中の形（PC 1 枚 + スマホ 1 枚の重ね。ユーザー指示 2026-11-05）。
 * 寸法は HeroShots の A-1 配置（幅 560px・PC 74%・スマホ 20% を右下に重ねる）と LaptopMock の比率に揃え、表示後の高さとずらさない。
 * 作品詳細全体のスケルトン（WorkDetailClient）と、画像の縦横判定中（HeroShots）の両方で使う。children は判定用の見えない画像を入れる用
 */
export const HeroShotsSkeleton: FC<{ children?: ReactNode }> = ({ children }) => (
  <div className="relative w-[560px] max-w-full motion-safe:animate-pulse">
    <div className="mx-auto w-[74%]">
      <div className="mx-auto w-[92%] rounded-t-[10px] bg-system-800 px-[3%] pb-[4%] pt-[3%]">
        <div className="aspect-[16/10] w-full rounded-[3px] bg-system-900" />
      </div>
      <div className="aspect-[40/1] w-full rounded-b-[8px] bg-system-800" />
    </div>
    <div className="@container absolute bottom-[2%] right-[8%] w-[20%]">
      <div className="aspect-[9/19] w-full rounded-[12cqw] border-[3cqw] border-system-800 bg-system-900" />
    </div>
    {children && <div className="absolute left-0 top-0">{children}</div>}
  </div>
);

/** URL 末尾の `#フラグメント` を分ける（サーバーには届かず、データ形式（URL 文字列）も変わらない） */
const splitFragment = (s: string) => {
  const i = s.indexOf("#");
  return i < 0 ? { src: s, frag: "" } : { src: s.slice(0, i), frag: s.slice(i + 1) };
};

/** 端末枠の中に出す画像 1 枚ぶん。browser = ブラウザバーを付ける / url = バーに出すドメイン */
type DeviceShot = { src: string; browser: boolean; url?: string };

/** フラグメントから端末枠の指定を読む（`#browser` / `#browser=example.com`）。`#plain` は枠なしの指定で、呼び出し側が先に見る */
const toDeviceShot = (raw: string): DeviceShot => {
  const { src, frag } = splitFragment(raw);
  if (!frag.startsWith("browser")) return { src, browser: false };
  return { src, browser: true, url: frag.includes("=") ? frag.slice(frag.indexOf("=") + 1) || undefined : undefined };
};

/** PC 1 枚 + スマホ 1 枚の重ね（幅 560px。PC は中央に幅 74%、スマホは幅 20% で PC の右端より 5% 外側に重ねる。ユーザー決定 2026-11-02: A-1 案） */
const HeroOverlap: FC<{ pc: DeviceShot; sp: DeviceShot; onClick: () => void }> = ({ pc, sp, onClick }) => (
  <div className="relative w-[560px] max-w-full">
    <div className="mx-auto w-[74%]">
      <LaptopMock src={pc.src} onClick={onClick} browser={pc.browser} url={pc.url} />
    </div>
    <div className="absolute bottom-[2%] right-[8%] w-[20%]">
      <PhoneMock src={sp.src} onClick={onClick} className="w-full" browser={sp.browser} url={sp.url} />
    </div>
  </div>
);

const HeroPc: FC<{ shot: DeviceShot; onClick: () => void }> = ({ shot, onClick }) => (
  <div className="w-[420px] max-w-full">
    <LaptopMock src={shot.src} onClick={onClick} browser={shot.browser} url={shot.url} />
  </div>
);

const HeroSp: FC<{ shot: DeviceShot; onClick: () => void }> = ({ shot, onClick }) => (
  <PhoneMock src={shot.src} onClick={onClick} browser={shot.browser} url={shot.url} />
);

/**
 * 管理画面で構成（hero_layout）を選んだ作品のヒーロー。画像の縦横は調べず、枠は構成どおりに決める。
 * slots は構成の枠数ぶんの配列（空き枠は ""）。空き枠は飛ばして描く。全部空なら呼び出し側が出さない
 */
const HeroLayoutShots: FC<{ layout: HeroLayout; slots: string[]; onClick: () => void }> = ({ layout, slots, onClick }) => {
  const filled = slots.filter(Boolean);
  if (layout === "sp2") {
    return (
      <>
        {filled.map((s, i) => (
          <HeroSp key={i} shot={toDeviceShot(s)} onClick={onClick} />
        ))}
      </>
    );
  }
  if (layout === "pcsp") {
    const [pcRaw, spRaw] = slots;
    if (pcRaw && spRaw) return <HeroOverlap pc={toDeviceShot(pcRaw)} sp={toDeviceShot(spRaw)} onClick={onClick} />;
    if (pcRaw) return <HeroPc shot={toDeviceShot(pcRaw)} onClick={onClick} />;
    return spRaw ? <HeroSp shot={toDeviceShot(spRaw)} onClick={onClick} /> : null;
  }
  if (layout === "pc") {
    return slots[0] ? <HeroPc shot={toDeviceShot(slots[0])} onClick={onClick} /> : null;
  }
  if (layout === "images") {
    // 枠なしの素の画像。フラグメントは付いていても落とす。1 枚は従来の `#plain` と同じ見た目
    const imgs = filled.map((s) => splitFragment(s).src);
    if (imgs.length === 0) return null;
    if (imgs.length === 1) {
      return (
        <button type="button" onClick={onClick} aria-label="画像を拡大表示" className="w-[560px] max-w-full cursor-zoom-in">
          <ProtectedImage src={imgs[0]} alt="" className="block h-auto w-full" />
        </button>
      );
    }
    // 2〜3 枚は OOUI 勉強会のヒーロー（pf-ooui-top-slides.png、1600×900）にならい、16:9 の札を左上から右下へ階段状に重ねる（ユーザー指示 2026-11-05）。
    // ずらし幅は 1 段 18.75%（同画像の 300/1600・168/900）。札の幅は最後の札が右下の角に届く値（3 枚 62.5% / 2 枚 81.25%）。手前が 1 枚目
    const step = 18.75;
    const size = 100 - step * (imgs.length - 1);
    return (
      <div className="relative aspect-video w-[560px] max-w-full">
        {imgs.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={onClick}
            aria-label="画像を拡大表示"
            className="absolute aspect-video cursor-zoom-in overflow-hidden rounded-[6px] border border-border shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{ left: `${step * i}%`, top: `${step * i}%`, width: `${size}%`, zIndex: imgs.length - i }}
          >
            <ProtectedImage src={src} alt="" className="block h-full w-full object-cover" />
          </button>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * ヒーローの画像（最大 2 枚）。画像の縦横で枠を選ぶ（横長 → ノート PC 枠・縦長 → スマホ枠。ユーザー指示 2026-11-02）。
 * データ形式（hero_screenshots の URL 配列）は変えない。判定が済むまで枠は描かない。
 * PC 1 枚 + スマホ 1 枚のときは、Library の WorkThumbnail Layout=a1（570:428）にならいスマホを PC に重ねる。
 * ユーザー指示（2026-11-02）でスマホは PC の右下、倍率は実寸寄り（PC 幅 0.88 に対しスマホ幅 0.15 ≒ 高さは PC 枠の約 2/3）。
 * それ以外は横並び・下端揃え
 */
const HeroShots: FC<{ shots: string[]; onClick: () => void }> = ({ shots: rawShots, onClick }) => {
  const [landscape, setLandscape] = useState<Record<string, boolean>>({});
  // URL 末尾のフラグメントで描き方を指定する（サーバーには届かず、データ形式（URL 配列）も変わらない。ユーザー指示 2026-11-02）:
  //   `#plain` = 端末の枠を付けず素の画像で出す（透過 PNG の合成図など）
  //   `#browser` / `#browser=example.com` = スマホ枠なら iOS Safari 風の下部バー、ノート PC 枠なら上部のブラウザバー（ドット 3 つ + URL）を付ける
  const split = splitFragment;
  const plain = rawShots.filter((s) => split(s).frag === "plain").map((s) => split(s).src);
  const browserOf: Record<string, string | undefined> = {};
  const shots = rawShots
    .filter((s) => split(s).frag !== "plain")
    .map((s) => {
      const { src, frag } = split(s);
      if (frag.startsWith("browser")) browserOf[src] = frag.includes("=") ? frag.slice(frag.indexOf("=") + 1) : "";
      return src;
    });
  if (plain.length > 0 && shots.length === 0) {
    return (
      <button type="button" onClick={onClick} aria-label="画像を拡大表示" className="w-[560px] max-w-full cursor-zoom-in">
        <ProtectedImage src={plain[0]} alt="" className="block h-auto w-full [aspect-ratio:auto_16/10]" />
      </button>
    );
  }
  const known = shots.every((s) => s in landscape);
  if (!known) {
    // 判定中も全体スケルトンと同じ形で高さを保つ（1px の判定用画像だけだと欄が潰れ、
    // 下のタイトル以下がスケルトン → 判定中 → 表示で上下に動く）
    return (
      <HeroShotsSkeleton>
        {shots.map((src) => (
          <OrientationProbe key={src} src={src} onResult={(v) => setLandscape((prev) => (src in prev ? prev : { ...prev, [src]: v }))} />
        ))}
      </HeroShotsSkeleton>
    );
  }
  const pc = shots.find((s) => landscape[s]);
  const sp = shots.find((s) => !landscape[s]);
  if (shots.length === 2 && pc && sp) {
    return (
      <HeroOverlap
        pc={{ src: pc, browser: pc in browserOf, url: browserOf[pc] || undefined }}
        sp={{ src: sp, browser: sp in browserOf, url: browserOf[sp] || undefined }}
        onClick={onClick}
      />
    );
  }
  return (
    <>
      {shots.map((src) =>
        landscape[src] ? (
          <div key={src} className="w-[420px] max-w-full">
            <LaptopMock src={src} onClick={onClick} browser={src in browserOf} url={browserOf[src] || undefined} />
          </div>
        ) : (
          <PhoneMock key={src} src={src} onClick={onClick} browser={src in browserOf} url={browserOf[src] || undefined} />
        ),
      )}
    </>
  );
};

/**
 * ツールのアイコン URL を決める。icon_url → スキル欄と同じ判定の public/logos のロゴ の順に、
 * 読み込みに失敗していない最初のものを返す。どちらも無い / 失敗済みなら null（文字 Tag にする）
 */
const resolveToolIconSrc = (t: WorkToolItem, broken: Record<string, boolean>): string | null => {
  const slug = resolveLogoSlug(t);
  const candidates = [t.icon_url, slug ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logos/${slug}.svg` : null];
  return candidates.find((src): src is string => Boolean(src) && !broken[src as string]) ?? null;
};

/**
 * 「事業責任者1・エンジニア3」「インターン5名」形式の関係者内訳を { name, count }[] に分解する。
 * 区切りは役割と同じ「・」「、」「,」。名前に数字を含む区切り（「エンジニア1〜2」等）も含め、
 * 1 つでも形式に合わなければ null（呼び出し側は元の文字列をそのまま出す）。
 */
export const parseStakeholderBreakdown = (
  raw: string | null | undefined
): { name: string; count: number }[] | null => {
  if (!raw) return null;
  const items: { name: string; count: number }[] = [];
  for (const seg of raw.split(/[・、,]/)) {
    const m = seg.trim().match(/^(\D+?)\s*(\d+)名?$/);
    if (!m) return null;
    items.push({ name: m[1].trim(), count: Number(m[2]) });
  }
  return items;
};

/** admin プレビューで「編集」ボタンを出せる領域（クリックで左カラムの該当入力欄へ移動する） */
export type WorkDetailEditRegion = "screenshots" | "title" | "tags" | "period" | "roles" | "stakeholders";

type WorkDetailHeaderProps = {
  work: Work;
  contents: string[];
  tools: WorkToolItem[];
  screenshots: string[];
  /** カテゴリタグの色相（0〜359）。未指定は既定色 */
  categoryHue?: number | null;
  /** admin プレビュー専用。渡すと各領域に編集ボタンを重ねる（公開ページでは渡さない＝見た目は変わらない） */
  onEdit?: (region: WorkDetailEditRegion) => void;
};

/* ------------------------------------------------------------------ *
 * 上部ブロック本体（Figma 787:9916 / _ProjectContents のブロック①②）
 * ------------------------------------------------------------------ */

const WorkDetailHeader: FC<WorkDetailHeaderProps> = ({ work, contents, tools, screenshots, categoryHue, onEdit }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [vizModal, setVizModal] = useState<"timeline" | "stakeholders" | null>(null);
  // 読み込みに失敗したアイコン URL。失敗したら次の候補（手元のロゴ → 文字 Tag）へ進む
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});
  // ヒーロー。構成（hero_layout）が選ばれていればその構成どおり、null（旧形式）なら画像の縦横で枠を自動判定する。
  // 構成が none か、画像が 1 枚も無ければ何も出さない（一覧のサムネイル画像で代用しない）
  const heroLayout = parseHeroLayout(work.hero_layout);
  const heroSlots = useMemo(
    () => (heroLayout ? parseHeroSlots(work.hero_screenshots, heroLayout) : []),
    [heroLayout, work.hero_screenshots],
  );
  const shots = heroLayout ? heroSlots.filter(Boolean) : screenshots;
  // images は枠なしで出すので、拡大表示も枠なし（#plain）にそろえる
  const lightboxShots = heroLayout === "images" ? shots.map((s) => `${splitFragment(s).src}#plain`) : shots;
  // 「全画面」ボタンで開く構造化ビジュアル（データが無ければボタン自体を非表示）。
  // jsonb のパースは該当カラムが変わったときだけ（WorkEditor と同じ useMemo 規約）
  const timeline = useMemo(() => parseTimeline(work.timeline), [work.timeline]);
  const { start_date, end_date, is_current } = work;
  const timelinePeriod = useMemo(
    () => periodFromRow({ start_date, end_date, is_current }),
    [start_date, end_date, is_current],
  );
  const stakeholders = useMemo(() => parseStakeholders(work.stakeholders), [work.stakeholders]);
  const roles = (work.role ?? "").split(/[・、,]/).map((r) => r.trim()).filter(Boolean);
  const stakeholderTags = useMemo(() => parseStakeholderBreakdown(work.stakeholder_breakdown), [work.stakeholder_breakdown]);

  // 編集ボタンを重ねる領域の基準位置（onEdit が無いときは何も足さず、公開ページの見た目を変えない）
  const rel = onEdit ? "relative " : "";
  // 文字やタグが右端まで届く領域は、ボタンの幅ぶん右に余白を取って重ならないようにする
  const relPad = onEdit ? "relative pr-10 " : "";

  return (
    <div className="flex w-full flex-col gap-12">
      {/* ヒーロー（構成を選んだ作品はその構成どおり。旧形式は最大2枚で、横長の画像はノート PC 枠・縦長はスマホ枠。下端を揃える） */}
      {shots.length > 0 && (
        <div className={`${rel}flex w-full flex-wrap items-end justify-center gap-6`}>
          {heroLayout ? (
            <HeroLayoutShots layout={heroLayout} slots={heroSlots} onClick={() => setLightboxOpen(true)} />
          ) : (
            <HeroShots shots={shots.slice(0, 2)} onClick={() => setLightboxOpen(true)} />
          )}
          {onEdit && <EditButton label="ヒーロー" onClick={() => onEdit("screenshots")} />}
        </div>
      )}
      {shots.length === 0 && onEdit && (
        <div className="relative flex min-h-10 items-center justify-center text-[12px] text-fg-muted">
          ヒーロー未設定
          <EditButton label="ヒーロー" onClick={() => onEdit("screenshots")} />
        </div>
      )}

      {/* カテゴリ + タイトル + 制作内容/Tools（gap-8）→ メタ表（gap-8）。Figma 787:9916 の Frame 427318239 は 3 要素とも gap 32 */}
      <div className="flex w-full flex-col gap-8">
        <div className="flex w-full flex-col gap-8">
          <div className={`${relPad}flex w-full flex-col gap-4 [word-break:break-word]`}>
            {work.category && <Tag variant="category" label={work.category} hue={categoryHue} className="self-start" />}
            <h1 className="text-title-pj text-fg">{work.title}</h1>
            {onEdit && <EditButton label="カテゴリ・タイトル" onClick={() => onEdit("title")} />}
          </div>

          {/* 制作内容 → Tools を 1 行で並べる（Tools は icon_url があればアイコン、無ければ文字 Tag） */}
          {(contents.length > 0 || tools.length > 0) && (
            <div className={`${relPad}flex w-full flex-wrap items-center gap-2`}>
              {contents.map((s) => (
                <Tag key={s} label={s} variant="content" />
              ))}
              {tools.map((t) => {
                const iconSrc = resolveToolIconSrc(t, brokenIcons);
                return iconSrc ? (
                  <Tooltip key={t.name} label={t.name}>
                    <ProtectedImage
                      src={iconSrc}
                      alt={t.name}
                      className="h-4 w-4 shrink-0 object-contain"
                      onError={() => setBrokenIcons((prev) => ({ ...prev, [iconSrc]: true }))}
                    />
                  </Tooltip>
                ) : (
                  <Tag key={t.name} label={t.name} variant="small" />
                );
              })}
              {onEdit && <EditButton label="制作内容・ツール" onClick={() => onEdit("tags")} />}
            </div>
          )}
          {contents.length === 0 && tools.length === 0 && onEdit && (
            <div className="relative flex min-h-10 items-center justify-center text-[12px] text-fg-muted">
              制作内容・ツール未設定
              <EditButton label="制作内容・ツール" onClick={() => onEdit("tags")} />
            </div>
          )}
        </div>

        {/* メタ表（Figma 787:9916）。列比は 1fr : 4fr（Figma 0.25fr : 1fr）。
            ラベル列の下限は max-content にして、ブラウザの既定フォントサイズを上げても
            ラベル文字（12px 固定）が仕切り線を越えないようにする（root 24px で「関係者」が越えた実績）。 */}
        <div className="grid w-full grid-cols-[minmax(max-content,1fr)_minmax(0,4fr)] overflow-hidden rounded-r8 border border-border">
          {/* 期間 */}
          <div className="flex min-h-10 items-center border-b border-border px-4">
            <span className="text-[12px] font-normal leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              期間
            </span>
          </div>
          <div className="relative flex min-h-10 items-center gap-2 border-b border-border px-4 after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:border-l after:border-border after:content-['']">
            {/* 値が無い行も表として残す。フォールバックは "—" に統一する
                （旧実装は "タイムライン（RACI）" と出していたが、期間データのように読めてしまう。
                  ボタンが何を開くかは aria-label が担う） */}
            <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={work.period ?? undefined}>
              {work.period || "—"}
            </span>
            {timeline && (
              <button
                type="button"
                onClick={() => setVizModal("timeline")}
                aria-label="タイムライン（RACI）を表示"
                className="relative flex size-6 shrink-0 items-center justify-center rounded-r8 bg-surface p-[6px] transition-colors before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border after:transition-colors after:content-[''] hover:after:border-system-500"
              >
                <Icon
                  set="Arrows"
                  name="full-screen-two"
                  tintColor="var(--color-system-500)"
                  className="h-full w-full"
                  aria-hidden
                />
              </button>
            )}
            {onEdit && <EditButton label="期間" onClick={() => onEdit("period")} className="ml-auto shrink-0" />}
          </div>

          {/* 役割 */}
          <div className="flex min-h-10 items-center border-b border-border px-4">
            <span className="text-[12px] font-normal leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              役割
            </span>
          </div>
          <div className="relative flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-4 py-[6px] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:border-l after:border-border after:content-['']">
            {roles.length > 0 ? (
              roles.map((r, i) => <Tag key={`${i}-${r}`} variant="tool" filled label={r} />)
            ) : (
              <span className="min-w-0 truncate text-body-03-jp text-fg-muted">—</span>
            )}
            {onEdit && <EditButton label="役割" onClick={() => onEdit("roles")} className="ml-auto shrink-0" />}
          </div>

          {/* 関係者 */}
          <div className="flex min-h-10 items-center px-4">
            <span className="text-[12px] font-normal leading-[1.5] tracking-[0.36px] whitespace-nowrap text-fg-muted">
              関係者
            </span>
          </div>
          <div className="relative flex min-h-10 flex-wrap items-center gap-2 px-4 py-[6px] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:border-l after:border-border after:content-['']">
            {stakeholderTags ? (
              stakeholderTags.map((s, i) => <Tag key={`${i}-${s.name}`} variant="tool" filled label={s.name} count={s.count} />)
            ) : (
              <span className="min-w-0 truncate text-body-03-jp text-fg-muted" title={work.stakeholder_breakdown ?? undefined}>
                {work.stakeholder_breakdown || "—"}
              </span>
            )}
            {stakeholders && (
              <button
                type="button"
                onClick={() => setVizModal("stakeholders")}
                aria-label="ステークホルダー体制を表示"
                className="relative flex size-6 shrink-0 items-center justify-center rounded-r8 bg-surface p-[6px] transition-colors before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border after:transition-colors after:content-[''] hover:after:border-system-500"
              >
                <Icon
                  set="Arrows"
                  name="full-screen-two"
                  tintColor="var(--color-system-500)"
                  className="h-full w-full"
                  aria-hidden
                />
              </button>
            )}
            {onEdit && <EditButton label="関係者" onClick={() => onEdit("stakeholders")} className="ml-auto shrink-0" />}
          </div>
        </div>
      </div>

      {lightboxOpen && <ScreenshotLightbox shots={lightboxShots} onClose={() => setLightboxOpen(false)} />}

      {vizModal && (
        <WorkVizModal
          kind={vizModal}
          timeline={timeline}
          period={timelinePeriod}
          stakeholders={stakeholders}
          onClose={() => setVizModal(null)}
        />
      )}
    </div>
  );
};

export default WorkDetailHeader;
