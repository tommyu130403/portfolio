# Figma 閲覧版(サイトが見られない人向け)

サイトが表示できない・ゲストログインで詰まった閲覧者向けに、公開ページを Figma に写したもの。Master・Library とは別のファイルで、Figma のプロトタイプとして共有する。

| 項目 | 値 |
|------|----|
| Figma ファイル | https://www.figma.com/design/rWpSqTlCHg7dxHPMFEthod |
| 共有リンク(プロトタイプ) | `components/AuthGate.tsx` の `FIGMA_VIEWER_URL` |
| 開始画面 | `00 はじめに`(node 16:2。PC 推奨と見かたの案内) |
| 画面 | `01 TOP` と `02`〜`13` の作品詳細(公開中の作品のみ。並びは TOP の作品一覧と同じ) |
| パスワード | オーナーがプロトタイプの共有設定で付ける。閲覧者にはゲスト ID と一緒に送る |
| 想定 | PC(横幅 1280px 以上)。スマホは考慮しない |

## 画面の作り

- 各画面は 1440×900 の縦スクロール。サイドメニューは複製を最前面に置いて固定している(`Sidebar (fixed)`。元のサイドメニューは透明にして残す)
- オーナーにだけ出る Developer 欄は非表示(ゲストの見え方にそろえる)。目次ボタン(`Button - 目次を開く`)も中身が無いので非表示
- クリックで動くもの: 開始画面のボタン → TOP / TOP の作品カード → 各作品 / 作品の前後ナビ・関連作品カード・「Works へ戻る」/ サイドメニューのロゴと Profile 欄(TOP では各節へスクロール、作品画面では TOP へ)
- 再現していないもの: 経歴の詳細ドロワー、スキルのアコーディオン、関係者図・タイムラインのモーダル、画像の拡大、問い合わせフォーム

**開始画面 `00 はじめに` は消して作り直さない。** サイトのリンクがこの画面の node ID(16:2)を指しているため、作り直すとリンクが開始画面を指さなくなる。文言を変えるときは中のテキストだけ直す。

## 公開前にオーナーがすること

1. Figma でファイルを開き、プレゼンテーション(再生)画面の「共有」から、プロトタイプの共有を「リンクを知っている人」+「パスワード必須」にしてパスワードを決める(パスワード付き共有は Professional 以上のプラン向け。オーナーのチームは Pro で利用可能。ボタン名は 2026-11 時点の調べで、画面では未確認)
2. ファイル本体(デザイン画面)の共有は「招待した人のみ」のままにする。本体まで開けると、隠したレイヤー(Developer 欄など)がレイヤー一覧から見えてしまう
3. シークレットウィンドウ(Figma にログインしていない状態)で `FIGMA_VIEWER_URL` を開き、パスワードで見られることを確かめる
4. ここまで済んでから、ログイン画面の導線を含む変更を公開する(先に公開すると、閲覧者が Figma の権限画面で止まる)

## 閲覧者への送り方

サイト自体が開けない人には、ログイン画面のリンクが届かない。ゲスト ID を送るときに、Figma の URL と Figma 用のパスワードも一緒に送る。ゲストログインのパスワードとは別物なので、書き分ける。

> ポートフォリオのゲスト ID: ○○○
> (サイトが開けない・ログインできないときの閲覧用)Figma 版: <FIGMA_VIEWER_URL>
> Figma 用のパスワード: ○○○ ※ PC での閲覧をおすすめします

Figma 用のパスワードを変えたときは、有効なゲスト ID を送った相手に新しいパスワードを送り直す。

## 画面と作品の対応

作品の id は、作品ページの URL の `?id=` 以降。

| 画面 | 作品 id(先頭) | 画面 | 作品 id(先頭) |
|------|------|------|------|
| 02 スカウト型の就活サービス立ち上げ | 894c880d | 08 募集掲載機能 | d0fc8a40 |
| 03 サービス立ち上げ期のユーザーリサーチ | e68325ec | 09 UX改善の基盤構築 | 94734d87 |
| 04 デザインシステム構築とコンポーネント設計 | 58d46b66 | 10 関連サービス間のデータ連携 | ed9e97dc |
| 05 価値観マッチング機能 | 8e73db10 | 11 登録導線の再設計 | 204128f2 |
| 06 開発体制改善 | 2ca4c159 | 12 企業情報メディアの立ち上げと運用 | 177adc06 |
| 07 24卒向けデザイナーサマーインターン企画 | ee9dcea3 | 13 OOUI勉強会(社内)企画・教材設計 | 0d524339 |

作品を非公開にしたときは、その画面を消し、TOP のカードと前後の作品のリンク先を張り直す(TOP は取り込み直す)。

## 更新が要るとき

`CLAUDE.md` §4-1 の表に当たる変更をしたら、更新するかをオーナーに提案する。作品 1 件だけの変更なら、その作品の画面だけ取り込み直して差し替える。

### 取り込み直しの手順(ローカルで行う)

ここから下は Claude が実行する技術メモ。オーナーは読まなくてよい。取り込みでは Figma 公式の取り込みスクリプトを、オーナーでログインした本番ページに読み込む点に注意する。

1. アプリ内ブラウザで本番 TOP(`https://tommyu130403.github.io/portfolio/`)を開く。オーナーでログイン済みであること。幅は `resize_window` で 1440×900
2. 下の「下準備スクリプト」を `javascript_tool` で実行する(全ページ読み込みのたびにやり直す)
3. `generate_figma_design` を fileKey だけで呼び、取り込み ID を受け取る
4. 作品は `await window.__capWork('<作品の id>', '<取り込み ID>')`、TOP は `window.__capTop('<取り込み ID>')` を実行する
5. `generate_figma_design` に同じ取り込み ID を渡して、完了するまで状態を確かめる
6. 新しい画面に、上の「画面の作り」の加工(縦スクロール化・サイドメニュー固定・Developer 欄と目次ボタンの非表示・リンク)を `use_figma` でかけ、古い画面と差し替える。差し替えた画面へ向いていたリンクも張り直す

### 取り込みの落とし穴(2026-11-18 に確認)

- **アプリ内ブラウザが隠れていると、描画の合図(requestAnimationFrame)・手すき時間の合図(requestIdleCallback)・画像の解読(img.decode)が止まり、取り込みが送信前で止まる。** 下準備スクリプトでタイマーに置き換える
- 画像は「画面に入ったら署名付き URL を取る」作り(`ProtectedImage`)。隠れた画面では判定が動かないので、IntersectionObserver を「常に画面内」に置き換えてから、ページ内遷移(`window.next.router.push`)で作品を開く。全ページ読み込みで開くと置き換えが間に合わない
- アイコンは CSS の型抜き(mask-image)で描いていて、取り込むと灰色の四角になる。取り込み前に SVG へ置き換える
- TOP の順次フェードイン(`data-reveal`)は `is-revealed` を付けて全部表示してから取り込む
- 取り込み用の操作バー(`#__figma_capture_toolbar_host__`)は隠してから取り込む

### 下準備スクリプト

2026-11-18 に実行して成功したのは、作品用の `__capWork` と同じ処理。`__capTop` は同じ部品の組み合わせだが、この形のままでは未実行(未確認)。`__endpoint` の promptId は必ず置き換える。

```js
window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
window.cancelAnimationFrame = id => clearTimeout(id);
window.requestIdleCallback = cb => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
window.cancelIdleCallback = id => clearTimeout(id);
HTMLImageElement.prototype.decode = function () {
  return this.complete ? Promise.resolve() : new Promise(r => { this.addEventListener('load', () => r(), { once: true }); this.addEventListener('error', () => r(), { once: true }); });
};
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { setTimeout(() => this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1, boundingClientRect: el.getBoundingClientRect() }], this), 0); }
  unobserve() {} disconnect() {} takeRecords() { return []; }
};
const s = document.createElement('script');
s.src = 'https://mcp.figma.com/mcp/html-to-design/capture.js';
document.head.appendChild(s);
await new Promise(r => { s.onload = r; s.onerror = r; setTimeout(r, 8000); });

window.__fixIcons = async () => {
  let n = 0;
  for (const el of document.querySelectorAll('[role="img"]')) {
    const cs = getComputedStyle(el);
    const m = (cs.maskImage || cs.webkitMaskImage || '').match(/url\("?(.*?)"?\)/);
    if (!m) continue;
    try {
      const svg = await (await fetch(m[1])).text();
      const c = cs.backgroundColor;
      el.style.maskImage = 'none'; el.style.webkitMaskImage = 'none'; el.style.background = 'transparent';
      el.innerHTML = svg.replace(/<svg/, '<svg width="100%" height="100%" ');
      el.querySelectorAll('[fill]:not([fill="none"])').forEach(p => p.setAttribute('fill', c));
      el.querySelectorAll('[stroke]:not([stroke="none"])').forEach(p => p.setAttribute('stroke', c));
      const root = el.querySelector('svg'); if (root && !root.getAttribute('fill')) root.setAttribute('fill', c);
      n++;
    } catch {}
  }
  return n;
};

// endpoint は generate_figma_design の返答に書かれた URL(promptId 付き)をそのまま使う。
// 2026-11-18 は promptId 付きで送って成功した。promptId を省いた形は未確認
window.__endpoint = cap => `https://mcp.figma.com/mcp/capture/${cap}/submit?bindVariables=true&promptId=<返答にある promptId>`;
const capture = cap => {
  document.getElementById('__figma_capture_toolbar_host__')?.style.setProperty('display', 'none');
  return window.figma.captureForDesign({ captureId: cap, endpoint: window.__endpoint(cap), selector: 'body' });
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitImages = async () => { for (let i = 0; i < 60; i++) { if (![...document.images].some(x => !x.complete || !x.naturalWidth)) return; await sleep(500); } };

window.__capTop = async cap => {
  document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-revealed'));
  await waitImages(); await window.__fixIcons(); scrollTo(0, 0);
  capture(cap);
};
window.__capWork = async (id, cap) => {
  window.next.router.push('/works?id=' + id);
  for (let i = 0; i < 40; i++) { await sleep(500); if (location.search.includes(id) && document.querySelector('h1')) break; }
  await sleep(2500); await waitImages();
  document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-revealed'));
  await window.__fixIcons(); scrollTo(0, 0);
  capture(cap);
};
```
