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

- 各画面は 1440×900。中身は内枠 `Scroll` に入れて縦スクロールさせ、その上にサイドメニュー(`Sidebar (fixed)`)と作品画面の見出し(`Header (fixed)`。パンくずと「nn / 12」・前後ボタンの行)を重ねて、スクロールしても動かないようにしている(元のサイドメニューと見出しは本文の中で透明にして残す)
- 作品画面は 2026-11-19 に作品詳細 v2(冒頭 1 カラム+左の目次)で取り込み直した。画面の枠(node ID `3:2`〜`14:2`)は残して中身だけ差し替えているので、TOP の作品カードや経歴ドロワーからのリンクはそのまま使える
- サイドメニューは部品 `サイドメニュー(閲覧版)` の「状態=通常 / ホバー」。ホバーで 216px に広がりラベルが出る。全画面で同じ部品を使う
- オーナーにだけ出る Developer 欄、問い合わせ(Contact)、ログアウトは非表示(Figma では使えないため)
- クリックで動くもの:
  - 開始画面のボタン → TOP / TOP の作品カード → 各作品 / 作品の前後ナビ・関連作品カード・「Works へ戻る」
  - 作品画面の左の目次 → その節へスクロール(見出しの 96px 上に置いた透明の目印 `目次の飛び先: <節名>` へ飛ぶ)
  - サイドメニューのロゴと Profile 欄(TOP では各節へスクロール、作品画面では TOP へ)/ Social の GitHub・YOUTRUST(新しいタブで外部サイト)
  - スキル欄の各行(部品 `スキル欄 1〜4(閲覧版)`。本番と同じく、カード 1 枚につき開くのは 1 行だけ)
  - 経歴の各項目 → 詳細ドロワー(`経歴ドロワー 1〜5(重ね表示)`。暗い背景のクリック・閉じる・前後の経歴・作品カードが動く)
- マウスを乗せたときの表示(本番と同じ色・影): サイドメニューの各項目、Social のツールチップ、TOP の作品カード、作品画面の関連作品カード・前後の作品カード・見出しの戻る/前後ボタン、ドロワー内の作品カード。部品は `_ホバー部品(閲覧版)` にまとめている(各部品の「状態=通常 / ホバー」。作品画面のものは `ホバー: <元の名前>(nn)`)
- 動き: サイドメニューの展開、スキル欄の開閉(0.3 秒で伸び縮み)、経歴ドロワーの開閉(右からすべり込む。`経歴ドロワー n(開く前)` → `(重ね表示)` → `(閉じる途中)` の 3 枚で作っている)、目次からのスクロール(0.4 秒)
- 再現していないもの: 画像の拡大、問い合わせフォーム、TOP の順次フェードイン、目次がスクロールに付いてくる動きと、読んでいる節に合わせた目次の強調の移動(Figma の API に追従表示の設定が無いため。目次は本文と一緒に流れ、強調は先頭の節に固定)

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
4. 作品は `await window.__capWork('<作品の id>', '<取り込み ID>')`、TOP は `window.__capTop('<取り込み ID>')` を実行する。作品の id は省略しない完全な形(下書き `docs/work-drafts/<id>.md` のファイル名)。先頭 8 文字だけだと「作品が見つからない」画面を取り込んで、取り込み ID を 1 つ無駄にする
5. `generate_figma_design` に同じ取り込み ID を渡して、完了するまで状態を確かめる
6. 作品画面は、既存の画面の枠を残して中身だけ差し替える(`use_figma`)。内枠 `Scroll` の中身と `Header (fixed)` を消し、取り込んだ `Body` を `Scroll` に移す → 取り込みのサイドメニューを透明に → パンくず行を複製して `Header (fixed)` として画面の (208, 80) に「絶対配置」で重ね、元の行は透明に → 前後ナビ・関連カード・「Works へ戻る」にリンク → 目次の各項目に `目次の飛び先` へのスクロール → 戻る/前後ボタン・前後カード・関連カードをホバー付き部品に置き換え → 目次の強調を先頭の節にそろえる
7. 確かめること: 画像の数が本番の `img` の数と同じか、グリッドの中の前後カードが 1 段に並んでいるか(本文の高さが取り込み直後と同じか)、見出しの矢印が灰色の四角になっていないか

### 取り込みの落とし穴(2026-11-18 に確認)

- **アプリ内ブラウザが隠れていると、描画の合図(requestAnimationFrame)・手すき時間の合図(requestIdleCallback)・画像の解読(img.decode)が止まり、取り込みが送信前で止まる。** 下準備スクリプトでタイマーに置き換える
- 画像は「画面に入ったら署名付き URL を取る」作り(`ProtectedImage`)。隠れた画面では判定が動かないので、IntersectionObserver を「常に画面内」に置き換えてから、ページ内遷移(`window.next.router.push`)で作品を開く。全ページ読み込みで開くと置き換えが間に合わない
- アイコンは CSS の型抜き(mask-image)で描いていて、取り込むと灰色の四角になる。取り込み前に SVG へ置き換える(`role="img"` が付いていないアイコンもあるので、型抜きを使う要素を全部たどる)
- Plugin API では、部品の複製(インスタンス)を含む要素を「スクロール時に固定」(`numberOfFixedChildren`)にできない。設定しても 0 に戻る。そのため内枠 `Scroll` をスクロールさせ、固定したい要素はその外に重ねている
- 重ね表示の背景(`overlayBackground`)は Plugin API から変えられない。ドロワーは 1440×900 の枠に「25% の黒い背景」と「ドロワー本体」を入れて重ね表示にしている
- スキル欄・関係者欄のように開くと伸びる部品は、親の枠を「中身に合わせる」(グリッドの行は `HUG`)にし、取り込みで付いた最大の高さ(`maxHeight`)を外さないと下の要素が押し下がらない
- ツール欄のロゴ(`/logos/*.svg` の画像)は、作品によって取り込みで空の枠になる。取り込む前に画像を SVG の図形に置き換えるか、`_ホバー部品(閲覧版)` の `ツールアイコン: <名前>` を置く。取り込み後は、16×16 の空の枠が残っていないかを必ず数える
- グリッド(GRID)の中の要素を部品に差し替えると、マスの位置がずれる。差し替え後に並び順どおりのマスへ戻す(後ろから順に動かす)
- 画像は読み込み後に透明から浮かび上がる作りで、取り込みの瞬間に透明のままだと Figma で空の枠になる(2026-11-18 にヒーロー 5 作品・本文 20 枚で発生)。取り込む前に `img` の透明度を 1 に固定し、取り込み後は「拡大表示」の枠に画像が入っているかを全作品で数える
- Plugin API の `figma.createImageAsync`(URL から画像を読む)はこの環境では使えない。画像が欠けたら、そのページを取り込み直して画像の入った枠を写す
- モーダルは本番で 1 つずつ開き、中身の複製を 1 つの入れ物に集めてから 1 回で取り込むと、取り込みの回数を減らせる。`captureForDesign` の完了待ち(await)は返ってこないことがあるので、待たずに送って Figma 側で完了を確かめる
- 経歴ドロワーの中のスクロール欄は、取り込む前に高さの制限を外して全部広げてから取り込み、Figma 側で高さ 762px・縦スクロールに戻す。下の方の画像はスクロールさせないと読み込まれない
- TOP の順次フェードイン(`data-reveal`)は `is-revealed` を付けて全部表示してから取り込む
- 取り込み用の操作バー(`#__figma_capture_toolbar_host__`)は隠してから取り込む

### 取り込みの落とし穴(2026-11-19 の v2 取り込みで確認)

- 作品画面の枠は「縦に並べる」自動レイアウト。重ねる要素(`Header (fixed)` など)を後から足すときは `layoutPositioning = 'ABSOLUTE'` にしないと、本文の下(y=900)に押し出されて見えなくなる
- 今いる作品と同じ id へページ内遷移すると、部品が作り直されず画像の読み込みが動かない(02 の端末画像 2 枚が空になった)。同じ作品を取り直すときは、いったん別の作品へ移ってから戻る
- 読み込めない画像が 1 枚でもあると、取り込みが送信前で止まる(08 のページ下端の画像 1 枚で発生。どの部品の画像かは未確認)。下準備スクリプトの `__waitImages` は 10 秒待っても読めない画像を隠してから進む
- 取り込みの瞬間の目次の強調は、直前のスクロール位置で決まる(03 では最後の節が強調されていた)。取り込み後に先頭の節へそろえる
- 前の作品で SVG に置き換えたアイコンの枠に灰色の塗りが残り、矢印が灰色の四角になることがある。名前が `Image - … icon` の枠で、中に図形があるのに塗りが付いているものは塗りを外す
- Figma の目次スクロールは、プロトタイプの画面を 1 回クリックしてからでないと効かないことがある(1 回目のクリックは画面の選択に使われる)

### 下準備スクリプト

2026-11-19 に作品 12 件を `__capWork` で取り込んで成功した。`__capTop` は同じ部品の組み合わせだが、この形のままでは未実行(未確認)。`__endpoint` の promptId は必ず置き換える。1 回の `javascript_tool` は 45 秒で打ち切られるので、作品は 1 件ずつ呼ぶ。

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

window.__fixIcons = async (root = document) => {
  let n = 0;
  for (const el of root.querySelectorAll('*')) {
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
// 完了待ち(await)は返ってこないことがあるので、送るだけにして Figma 側で完了を確かめる
const capture = cap => {
  document.getElementById('__figma_capture_toolbar_host__')?.style.setProperty('display', 'none');
  window.figma.captureForDesign({ captureId: cap, endpoint: window.__endpoint(cap), selector: 'body' });
  return 'sent';
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 10 秒待っても読めない画像は隠す(1 枚でも残ると送信前で止まる)
const waitImages = async () => {
  for (let i = 0; i < 20; i++) { if (![...document.images].some(x => !x.complete || !x.naturalWidth)) return; await sleep(500); }
  [...document.images].filter(x => !x.naturalWidth).forEach(x => { x.removeAttribute('src'); x.style.visibility = 'hidden'; });
};
// 浮かび上がり途中の画像を不透明に固定する
const unfade = () => {
  document.querySelectorAll('img').forEach(img => { let el = img; for (let k = 0; k < 4 && el; k++) { if (parseFloat(getComputedStyle(el).opacity) < 1) { el.style.setProperty('opacity', '1', 'important'); el.style.setProperty('transition', 'none', 'important'); } el = el.parentElement; } });
  document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-revealed'));
};

window.__capTop = async cap => {
  await waitImages(); unfade(); await window.__fixIcons(); scrollTo(0, 0);
  return capture(cap);
};
// 2026-11-19 に 12 作品すべてこの形で取り込んだ。id は完全な形で渡す
window.__capWork = async (id, cap) => {
  window.next.router.push('/works?id=' + id);
  for (let i = 0; i < 40; i++) { await sleep(500); if (location.search.includes(id) && document.querySelector('h1')) break; }
  await sleep(2500);
  // 下までスクロールして、遅れて読み込む画像を起こす
  for (let y = 0; y < document.documentElement.scrollHeight; y += 800) { scrollTo(0, y); await sleep(150); }
  scrollTo(0, 0);
  await waitImages(); await sleep(800);
  unfade(); await window.__fixIcons(); scrollTo(0, 0); await sleep(300);
  return capture(cap);
};
```
