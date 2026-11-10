-- 2026-11-06 公開 12 作品の文章修正(監査 C4〜C13・表記統一・作品別 #1/#5/#8/#9)。ユーザー承認済み・本番適用済み
-- 手順: 控え → 試し実行(各置換 1 回・md5)→ 適用(書き換え前の md5 一致時のみ)→ 別の読み取りで照合 → 公開画面で目視
begin;
create table private.works_sections_backup_20261106c as
  select id, sections, now() as saved_at from public.works where left(id::text, 8) in ('0d524339', '177adc06', '204128f2', '2ca4c159', '58d46b66', '894c880d', '8e73db10', '94734d87', 'd0fc8a40', 'e68325ec', 'ed9e97dc', 'ee9dcea3');
alter table private.works_sections_backup_20261106c enable row level security;
revoke all on table private.works_sections_backup_20261106c from public, anon, authenticated;
with recursive base(wid, md5) as (values
  ('0d524339', '2ea28d00ed32d4e989621fb89c091dac'),
  ('177adc06', 'b921037027aba83f18efab9e05f5ec2c'),
  ('204128f2', '863e8eef216671004c218ade0945d55c'),
  ('2ca4c159', '0d731ffde3e278d559b0894e293db7f1'),
  ('58d46b66', '7a83efc4ea14490689ac61c090b62861'),
  ('894c880d', '6097fdec183b9369909d80d9567b137f'),
  ('8e73db10', 'b32e0db6cd3c5270af2be5d453805084'),
  ('94734d87', 'a490426cc030aa673325a03a9e3f4514'),
  ('d0fc8a40', 'f18882c700f1328b66f5476e462c639a'),
  ('e68325ec', '9d5323c71d3599b7977f10693ecff23e'),
  ('ed9e97dc', '4b90c4f04db0e66a9d5e8fd9f29242c2'),
  ('ee9dcea3', 'e42404460e3ffeb095f250dd681b4275')
),
reps(wid, k, old, new) as (values
  ('94734d87', 1, $q$3カ年$q$, $q$3か年$q$),
  ('894c880d', 1, $q$約 3.5 ヶ月$q$, $q$約 3.5 か月$q$),
  ('d0fc8a40', 1, $q$1ヶ月程度$q$, $q$1か月程度$q$),
  ('ed9e97dc', 1, $q$約5.5ヶ月$q$, $q$約5.5か月$q$),
  ('204128f2', 1, $q$どのサービスに対する回答かが分かるように$q$, $q$どのサービスに対する回答かがわかるように$q$),
  ('894c880d', 2, $q$十分ではないと分かった$q$, $q$十分ではないとわかった$q$),
  ('94734d87', 2, $q$何から進めればいいか分からない$q$, $q$何から進めればいいかわからない$q$),
  ('8e73db10', 1, $q$その人がどういう人かが分かる$q$, $q$その人がどういう人かがわかる$q$),
  ('8e73db10', 2, $q$のタイプが分か$q$, $q$のタイプがわか$q$),
  ('d0fc8a40', 2, $q$何ができるか分かる$q$, $q$何ができるかわかる$q$),
  ('204128f2', 2, $q$登録導線を1本化し$q$, $q$登録導線を一本化し$q$),
  ('58d46b66', 1, $q$figmaでの運用を設計。$q$, $q$Figma での運用を設計した。$q$),
  ('d0fc8a40', 3, $q$製品版に向けて$q$, $q$正規版に向けて$q$),
  ('94734d87', 3, $q$## 1~3. $q$, $q$## 1〜3. $q$),
  ('8e73db10', 3, $q$「就活軸 => 価値観」$q$, $q$「就活軸 → 価値観」$q$),
  ('894c880d', 3, $q$FY2021前半$q$, $q$2021年度前半$q$),
  ('894c880d', 4, $q$事業の狙いとして、同サービスのエージェント事業(キャリアチケット就職エージェント)において弊社カウンセラーが本来担う「強みを見つける・軸を固める」プロセスを機能として落とし込むことでプロフィール入力で手助けし、人を介さずに企業とマッチングできるようにすることを目的とした。$q$, $q$事業の狙いは、同サービスのエージェント事業(キャリアチケット就職エージェント)でカウンセラーが担ってきた「強みを見つける・軸を固める」支援を、プロフィール入力の機能に置き換えることだった。これにより、人を介さずに学生と企業をマッチングできるようにする。$q$),
  ('894c880d', 5, $q$当サービスが支援できる範囲として「1000人未満の、認知度の低い企業」であり、$q$, $q$これまで支援できていたのは「1000人未満の、認知度の低い企業」で、$q$),
  ('e68325ec', 1, $q$アジャイル開発を導入している当プロジェクト(キャリアチケットスカウトβ版リリース)においてはリリースそのものが仮説検証であったため、リサーチを開発プロセスに導入することでより仮説検証の確度をあげてリリースに臨むことができた。$q$, $q$キャリアチケットスカウトのβ版開発はアジャイル開発で進めており、リリースそのものが仮説検証だった。そのため、リサーチを開発プロセスに組み込み、仮説の確度を上げてからリリースに臨めた。$q$),
  ('177adc06', 1, $q$本PJのデザイン品質定義$q$, $q$このプロジェクトのデザイン品質定義$q$),
  ('e68325ec', 2, $q$## スコープ
使い勝手より、機能への印象・意見を聞くことを優先した。そのため、実際のユーザー端末での再現はこの段階では求めなかった。$q$, $q$## スコープ外

- 使い勝手の評価(機能への印象・意見を聞くことを優先した)
- 実際のユーザー端末での再現$q$),
  ('ee9dcea3', 1, $q$## 評価しないこと

- 新規事業の開発・デザイン
- ビジネスモデルや緻密な事業計画書
- 答えを教えるような指導。メンターは「なぜ」を問いかけ、考えることは学生自身に任せる。
$q$, $q$## スコープ外

次の項目は評価の対象外とした。

- 新規事業の開発・デザイン
- ビジネスモデルや緻密な事業計画書
$q$),
  ('ee9dcea3', 2, $q$どの工程で助けを求めているかを把握してから関わるようにした。$q$, $q$どの工程で助けを求めているかを把握してから関わるようにした。メンターは答えを教えず「なぜ」を問いかけ、考えることは学生自身に任せる方針とした。$q$),
  ('0d524339', 1, $q$## スコープ外

- 架空のサービスは使わない
- サービスの優劣は論じず、構造の指摘に限る$q$, $q$## スコープ外

- 架空のサービスを題材にすること
- サービスの優劣の評価(構造の指摘に限る)$q$),
  ('94734d87', 4, $q$キャリアチケットスカウトが立ち上げ期$q$, $q$キャリアチケットスカウト(以下 CTS)が立ち上げ期$q$),
  ('894c880d', 6, $q$人事・RA の視点$q$, $q$人事・RA(企業の採用を支援する営業担当)の視点$q$),
  ('204128f2', 3, $q$エージェントのCVR・面談設定数$q$, $q$エージェントのコンバージョン率・面談設定数$q$),
  ('ed9e97dc', 2, $q$予約 CVR はほぼゼロ$q$, $q$予約のコンバージョン率はほぼゼロ$q$),
  ('d0fc8a40', 4, $q$デザインFB$q$, $q$デザインのフィードバック$q$),
  ('894c880d', 7, $q$ガクチカには選択式のカテゴリ$q$, $q$ガクチカ(学生時代に力を入れたこと)には選択式のカテゴリ$q$),
  ('ed9e97dc', 3, $q$送信からクリックへの展開率が改善した$q$, $q$送信からクリックへ進んだ割合(展開率)が改善した$q$),
  ('177adc06', 2, $q$ファーストタッチの遷移率が改善$q$, $q$最初の接点(ファーストタッチ)からの遷移率が改善$q$),
  ('94734d87', 5, $q$ウェットな情報を$q$, $q$社風や人柄など、数字に表れない情報を$q$),
  ('ed9e97dc', 4, $q$外部設計レビューを担った$q$, $q$外部設計(画面と操作の仕様)のレビューを担った$q$),
  ('204128f2', 4, $q$- スカウト型転職サービスの収益性が、目標から大きく乖離していた。$q$, $q$- スカウト型転職サービスの収益化が、想定より遅れていた。$q$),
  ('204128f2', 5, $q$企業ロゴの掲載は、優良誤認と取られかねなかった。$q$, $q$企業ロゴの掲載も、実際より多くのスカウトが届く印象を与えるおそれがあった。$q$),
  ('177adc06', 3, $q$- 中間コンバージョン数は、ベースラインも成長率も訪問数と乖離しており、下期の重点課題である$q$, $q$- 中間コンバージョン数の伸びが訪問数の伸びに追いついておらず、下期の重点課題である$q$),
  ('177adc06', 4, $q$FactBoardは、働きながら転職活動をする人に向けた企業情報プラットフォーム。$q$, $q$働きながら転職活動をする人に向けた企業情報プラットフォームFactBoardの立ち上げと運用に関わった。$q$),
  ('177adc06', 5, $q$2026年3月にリリース。$q$, $q$2026年3月にリリースした。$q$),
  ('204128f2', 6, $q$登録導線を1本にまとめたプロジェクト。$q$, $q$登録導線を一本にまとめた。$q$),
  ('8e73db10', 4, $q$価値観マッチング機能を企画・仕様化したプロジェクト。$q$, $q$価値観マッチング機能を企画した。$q$),
  ('94734d87', 6, $q$を明確にするためのプロジェクト。$q$, $q$を明確にするプロジェクトを進めた。$q$),
  ('d0fc8a40', 5, $q$機能を企画したプロジェクト。$q$, $q$機能を企画した。$q$),
  ('e68325ec', 3, $q$キャリアチケットスカウト立ち上げ期に実施したユーザーリサーチ。$q$, $q$キャリアチケットスカウトの立ち上げ期に、ユーザーリサーチを行った。$q$),
  ('ed9e97dc', 5, $q$ユーザーが登録し直さずに行き来できるようにする連携プロジェクト。$q$, $q$ユーザーが登録し直さずに行き来できるよう、サービス間の連携を整えた。$q$),
  ('ee9dcea3', 3, $q$24卒のデザイナー志望学生を対象にした、3日間のサマーインターンシップ。$q$, $q$24卒のデザイナー志望学生を対象に、3日間のサマーインターンシップを企画・運営した。$q$),
  ('0d524339', 2, $q$![](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-simulator.png)$q$, $q$![第1回の画面数シミュレータ](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-simulator.png)$q$),
  ('0d524339', 3, $q$![](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-antipatterns.png)$q$, $q$![第1回の診断の型(5つの症状のカード)](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-antipatterns.png)$q$),
  ('0d524339', 4, $q$![](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-object-model.png)$q$, $q$![第3回の演習の答え合わせ(オブジェクトモデル)](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-object-model.png)$q$),
  ('0d524339', 5, $q$![](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-layout-switch.png)$q$, $q$![第4回の2つのレイアウトの比較](https://kljlxjlbetaxhtxqzrdc.supabase.co/storage/v1/object/public/Portfolio/projects/sections/pf-ooui-layout-switch.png)$q$),
  ('2ca4c159', 1, $q$

対策として、スケジュールの問題を個人の頑張りに依存させる状態を避けるため、要件・計画フェーズでのMVP定義と代替プランを検討することでカバーできる体制をルールとして取り決めた。

# 所感
$q$, $q$

# 成果

スケジュールの問題を個人の頑張りに依存させないため、要件・計画フェーズでMVPと代替プランを定義する体制を、ルールとして取り決めた。

# 学び
$q$),
  ('94734d87', 7, $q$# 背景と目的
$q$, $q$# 背景と課題
$q$),
  ('894c880d', 8, $q$# 方針と要件

## β版の範囲$q$, $q$## β版の範囲$q$),
  ('ed9e97dc', 6, $q$# 検証結果
$q$, $q$## 検証結果
$q$),
  ('894c880d', 9, $q$- 2021年8月に学生向けアプリ、11月に企業向けWebアプリを予定どおりにリリースし、MVPの機能はすべて実装できた。$q$, $q$- 2021年8月に学生向けアプリを、11月に企業向けWebアプリをリリースした(企業側は計画から約2か月遅れ)。MVPの機能はすべて実装できた。$q$),
  ('ed9e97dc', 7, $q$note: LP と再登録をスキップ。面談予約率を約2倍に伸ばせる余地があると試算$q$, $q$note: LP と再登録をスキップ$q$),
  ('94734d87', 8, $q$::: flow 4 段階の計画 highlight=4$q$, $q$::: flow 当初の 4 段階計画 highlight=4$q$),
  ('8e73db10', 5, $q$企業側のデザイン調整は2月上旬に始め$q$, $q$企業側のデザイン調整は2022年2月上旬に始め$q$),
  ('d0fc8a40', 6, $q$次年度の就活開始時期である3月までに$q$, $q$次年度の就活開始時期である2023年3月までに$q$),
  ('58d46b66', 2, $q$カラーの定義やコンポーネントの構成を検討した。基本構造としてAtomic Designを採用した。

> **Atomic Design（Brad Frost, 2013年提唱・2016年書籍化）**
>UIを化学のメタファーで5段階に分けている。Atoms（ボタン、入力欄、ラベルなどこれ以上分解できない最小要素）、Molecules（検索フォーム＝ラベル＋入力＋ボタンのような小さな組み合わせ）、Organisms（ヘッダーや候補者一覧カードなど、意味のあるまとまり）、Templates（データを入れる前のページの骨組み）、Pages（実データが入った最終画面）です。Frost自身は、これは厳密なフォルダ分類ではなく「部品から全体へ、全体から部品へ行き来して考えるためのメンタルモデル」だと述べた。$q$, $q$カラーの定義やコンポーネントの構成を検討した。基本構造は Atomic Design(Brad Frost)を採用し、5層をコードの層に対応させた。$q$)
),
src as (
  select w.id, left(w.id::text, 8) wid, md5(w.sections::text) cur,
    (select string_agg('# '||(e->>'heading')||E'\n\n'||(e->>'body'), E'\n\n' order by o) from jsonb_array_elements(w.sections) with ordinality x(e, o)) md
  from public.works w where left(w.id::text, 8) in ('0d524339', '177adc06', '204128f2', '2ca4c159', '58d46b66', '894c880d', '8e73db10', '94734d87', 'd0fc8a40', 'e68325ec', 'ed9e97dc', 'ee9dcea3')
),
step(id, wid, k, t, hits) as (
  select id, wid, 0, md, null::int from src
  union all
  select s.id, s.wid, s.k + 1, replace(s.t, r.old, r.new),
         (length(s.t) - length(replace(s.t, r.old, ''))) / greatest(length(r.old), 1)
  from step s join reps r on r.wid = s.wid and r.k = s.k + 1
),
fin as (
  select distinct on (id) id, wid, translate(t, '（）', '()') t from step order by id, k desc
),
parts as (
  select f.id, f.wid, p.ord, p.part from fin f, regexp_split_to_table(E'\n' || f.t, E'\n# ') with ordinality p(part, ord)
),
out as (
  select id, wid, jsonb_agg(jsonb_build_object('heading', split_part(part, E'\n', 1),
           'body', btrim(substr(part, length(split_part(part, E'\n', 1)) + 1), E' \n\t')) order by ord) sections
  from parts where ord > 1 group by id, wid
)
update public.works w set sections = o.sections
from out o join src s on s.id = o.id join base b on b.wid = s.wid
where w.id = o.id and s.cur = b.md5
  and not exists (select 1 from step t where t.k > 0 and t.hits <> 1);
commit;
-- 追加修正(同日・承認済み): 0d524339 の画像 4 枚で、代替テキストが画面の説明としても出て二重になったため、
-- 長い説明を ![...] 側へ移し ::: caption 行を削除した(控え private.works_sections_backup_20261106d)。
-- 手順は上と同じ型で、sections->3(取り組み)の body だけを置換。適用後 md5 = 5d5fb7e8834b1c7b39080365ad746c62

-- 検証(別に実行): 期待 md5(適用後)
-- 0d524339 5d5fb7e8834b1c7b39080365ad746c62 / 177adc06 0b6df9d8698bd429eb5caf791edc0c4d / 204128f2 518b3509112e6a72fe650e8217d96505
-- 2ca4c159 e4e24f07fb76de2348ed2a408fa2aa5e / 58d46b66 b4961975c900e36d397abc053dc1e7ca / 894c880d a2b76c06b435f6a343cf0f221209005d
-- 8e73db10 f44accf1c84ea1a02d6da9e965fabb89 / 94734d87 26fcf6194f5ea7c704b99b614eaeabda / d0fc8a40 7f95769f4583dcb08f91f98638967cf6
-- e68325ec c0ee4c8cafd1df75859c4f2ab4e0e338 / ed9e97dc 4fe790ac780fbc7c2a5a8fb57f1d3e67 / ee9dcea3 e7025516ac33ae4a30502ca7329d7a0c
-- select left(id::text, 8), md5(sections::text) from works where is_published order by 1;

-- 戻すとき(必要になった場合のみ。12 作品すべてを今回の書き換え前へ):
-- update public.works w set sections = b.sections from private.works_sections_backup_20261106c b where w.id = b.id;

-- 追加(同日・承認済み): S13 作品名の統一(控え private.works_title_backup_20261106)
-- 204128f2「登録導線の再設計 (キャリアチケット転職)」→「登録導線の再設計」
-- 58d46b66「…開発設計(CDD) (キャリアチケットスカウト)」→「デザインシステム構築とコンポーネント駆動開発設計(CDD)」
-- 0d524339「OOUI勉強会（社内）企画・教材設計」→「OOUI勉強会(社内)企画・教材設計」
-- e68325ec「サービス立ち上げ期 ユーザーリサーチ 」→「サービス立ち上げ期のユーザーリサーチ」
-- サービス名の欄(hero_brand)は作品カードにしか出ないため、204128f2 の概要 1 文目を「キャリアチケット転職で、…」に(控え private.works_sections_backup_20261106e)。
-- 適用後 md5: 204128f2 198eb97850491889b5029fd9dc71aedd
-- 作品名を戻す: update public.works w set title = b.title from private.works_title_backup_20261106 b where w.id = b.id;
