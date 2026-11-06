begin;
-- 控え: 書き換え前の本文を private スキーマに複製(誰からも読めないよう権限を外す)
create table private.works_sections_backup_20261105 as
  select id, sections, now() as saved_at from public.works where left(id::text, 8) in ('204128f2', '58d46b66', '8e73db10', 'd0fc8a40', 'ee9dcea3');
alter table private.works_sections_backup_20261105 enable row level security;
revoke all on table private.works_sections_backup_20261105 from public, anon, authenticated;
with recursive reps(wid, k, old, new) as (values
  ('8e73db10', 1, '- 学生側・企業側のデザインを作成した。【要確認: 最終デザインとして確定した画面】\n- 【要確認: リリース後のオファー承諾率など、効果検証の結果】', '- 学生側・企業側のデザインを作成した。\n- 2022年3月に本番リリースした。既存のスカウト体験に大きな悪影響を与えず、登録者数が増えた。'),
  ('d0fc8a40', 1, '- 【要確認: ユーザーヒアリングの実施結果】\n- 【要確認: 最終デザインと、リリース後の応募状況】\n\n', ''),
  ('204128f2', 1, '| チーム体制 | 【要確認: チームの人数と職種構成】 |\n| 自分の担当範囲 | 【要確認: 要件整理・UX設計・UIデザイン・効果検証のうち、どこを担ったか】 |', '| 自分の担当範囲 | 要件整理と、UX・UI 設計のレビュー |'),
  ('204128f2', 2, '採用した案は【要確認: 最終的に採用したパターン】', '採用したのは案 2(判定項目までを必須)。'),
  ('204128f2', 3, '- エージェント側のコンバージョン率・面談設定数を維持できたかは【要確認: ゴールに対する達成判定】。リリース前後で計測の定義が異なり、単純比較はできない。', '- エージェント側のコンバージョン率・面談設定数は、リリース後も維持できた。リリース前後で計測の定義が異なるため、数値の比較は載せていない。'),
  ('204128f2', 4, '【要確認: 成果のうち、自分の働きによるもの】', '要件整理と UX・UI 設計のレビューを担い、統合後の導線の体験と画面の品質を担保した。'),
  ('58d46b66', 1, '- 【要確認: 運用後の効果(スタイル衝突の件数・新規画面の着手速度など)】\n', '- 立ち上げと同時に定めた設計のため、導入前との比較はしていない。\n'),
  ('ee9dcea3', 1, '| 企画担当 | 1名(監修・審査担当が監修) |', '| 企画担当 | 2名(自分を含む。監修・審査担当が監修) |'),
  ('ee9dcea3', 2, '- 【要確認: 企画・プログラム設計にどこまで関わったか】', '- 企画とプログラム設計(企画担当と2名で担当)'),
  ('ee9dcea3', 3, '| 人数 | 最小6人程度、上限12人とした。', '| 人数 | 当初は最小6人程度、上限12人と想定した(実際の人数は調整した)。'),
  ('ee9dcea3', 4, 'に変更した。【要確認: 題材と形式を変更した理由】', 'に変更した。学生がユーザーの立場になって考えられるよう、題材の難易度を下げて適切な水準に合わせたためである。'),
  ('ee9dcea3', 5, '全体進行とメインメンターを担当した。【要確認: 進行・メンタリングで具体的に工夫したこと】', '全体進行とメインメンターを担当した。助言やフォローの前に、学生が「何がわからないのか」「何をしたいのか」を確かめ、どの工程で助けを求めているかを把握してから関わるようにした。'),
  ('ee9dcea3', 6, '満足度の尺度は【要確認: 満足度・興味の評価尺度(何点満点か)】である。', '満足度と興味は10点満点である。'),
  ('ee9dcea3', 7, '| 各チームの最終提案 | 【要確認: 学生チームの提案内容を掲載できるか】 |\n', ''),
  ('ee9dcea3', 8, '| 採用への結果 | 【要確認: 就業型インターン・内定につながったか】 |', '| 採用への結果 | 内定にはつながらなかった。参加した学生が個人でブログなどに発信しており、認知度の向上には効果があった可能性がある |'),
  ('ee9dcea3', 9, '| 自分の貢献 | 【要確認: 自分の担当が成果にどう効いたか】 |', '| 自分の貢献 | メインメンターとしての関わりが、満足度の高さに一定寄与したと考えている |'),
  ('ee9dcea3', 10, '\n\n【要確認: 自分自身の学びと、それを次にどう活かしたか】', '')
),
step(id, wid, k, t, hits) as (
  select id, left(id::text, 8), 0, sections::text, null::int from works where left(id::text, 8) in ('204128f2', '58d46b66', '8e73db10', 'd0fc8a40', 'ee9dcea3')
  union all
  select s.id, s.wid, s.k + 1, replace(s.t, r.old, r.new),
         (length(s.t) - length(replace(s.t, r.old, ''))) / greatest(length(r.old), 1)
  from step s join reps r on r.wid = s.wid and r.k = s.k + 1
),
fin as (
  select distinct on (id) id, wid, t::jsonb j from step order by id, k desc
),
out as (
  select f.id, f.wid,
    (select jsonb_agg(e order by o) from jsonb_array_elements(f.j) with ordinality x(e, o)
      where not (f.wid in ('204128f2', '58d46b66') and e->>'heading' = '学び')) as sections
  from fin f
)
update public.works w set sections = o.sections from out o where w.id = o.id;
commit;

-- 検証(別に実行): 【要確認】が 0 件・見出しの並び・md5 が試し実行と一致すること
select left(id::text, 8) wid, (select count(*) from regexp_matches(sections::text, '【要確認', 'g')) left_todo,
       md5(sections::text) md5
from works where left(id::text, 8) in ('204128f2', '58d46b66', '8e73db10', 'd0fc8a40', 'ee9dcea3') order by 1;
-- 期待値(試し実行 2026-11-05): 全行 left_todo = 0、md5 は次と一致
-- 204128f2 863e8eef216671004c218ade0945d55c
-- 58d46b66 7a83efc4ea14490689ac61c090b62861
-- 8e73db10 5b439d22806a38e0d76fd0c9c558cad5
-- d0fc8a40 938a8250fa2ab70733b6ca7930769257
-- ee9dcea3 e42404460e3ffeb095f250dd681b4275

-- 戻すとき(必要になった場合のみ):
-- update public.works w set sections = b.sections from private.works_sections_backup_20261105 b where w.id = b.id;

-- 追記(同日): 8e73db10 と d0fc8a40 の「成果」に画面の図を追加した。書き換え前の控えは private.works_sections_backup_20261105b
-- 追加後の照合値(上の期待値のうち、この 2 件はこちらが正)
-- 8e73db10 293c4f82eb427abd13b7c9a08a93e5a5
-- d0fc8a40 f18882c700f1328b66f5476e462c639a
-- 画像の追加だけを戻すとき:
-- update public.works w set sections = b.sections from private.works_sections_backup_20261105b b where w.id = b.id;
-- 上の「戻すとき」は 5 作品すべてを最初の状態へ戻す(画像の追加も消える)

-- 追記(2026-11-06): 8e73db10 の PC 画像が枠(比率 1.60)より横長で右端が切れたため、上下に余白を足した
-- pf-values-final-company-offer-select-2022spec-16x10.png(1219x762)へ参照を差し替えた。控えは private.works_sections_backup_20261106
-- 差し替え後の照合値: 8e73db10 b32e0db6cd3c5270af2be5d453805084(公開画面で目視済み)
-- 戻すとき: update public.works w set sections = b.sections from private.works_sections_backup_20261106 b where w.id = b.id;
