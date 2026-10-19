-- Work タグ用スキル語彙 skills_vocab のラベル見直し（2026-10-19）
-- 決定の記録: 見直しシート https://claude.ai/artifact/Ej6QpnfBNrcNzcWaNUC6SV
-- 戻し用: supabase/backups/20261019_work_skill_tags_pre_update.json（本番の適用前の状態）
--
-- 18語 → 15語
--   統合  : UI Design + UX Design → Product Design（両方付いていた作品は1つにまとめる）
--   名前変更: Frontend Development → Frontend / Web Accessibility → Accessibility / Design System → Design Systems
--   削除  : Requirement Definition / Roadmap Planning / AI UX / Responsive Design / Wireframing / Component Design
--   新設  : Product Strategy / Validation / Education / Planning（言葉だけ。作品には付けない）
--   そのまま: Visual Design / UX Research / Product Management / Project Management / Prototyping / AI Integration / Prompt Design
--
-- dev（aemqzbsofprgmwtpfndf）・本番（kljlxjlbetaxhtxqzrdc）とも同じ SQL を流す。
-- dev は work_skills が 0 件なので、作品側の付け替えは何もせず語彙だけ変わる。
-- 消す言葉は「作品との紐づけを外す → 言葉を消す」の順（work_skills → skills_vocab の外部キーが ON DELETE RESTRICT のため）。

-- ── 適用 ─────────────────────────────────────────────
begin;

-- 1. UI Design を Product Design に改名（UI Design の紐づけはそのまま Product Design になる）
update skills_vocab set label = 'Product Design' where label = 'UI Design';

-- 2. UX Design だけが付いている作品に Product Design を付ける（並び位置は UX Design のものを引き継ぐ）
insert into work_skills (work_id, skill_id, sort_order)
select ws.work_id, pd.id, ws.sort_order
from work_skills ws
join skills_vocab ux on ux.id = ws.skill_id and ux.label = 'UX Design'
cross join (select id from skills_vocab where label = 'Product Design') pd
where not exists (
  select 1 from work_skills x where x.work_id = ws.work_id and x.skill_id = pd.id
);

-- 3. 消す言葉の紐づけを外す
delete from work_skills
where skill_id in (
  select id from skills_vocab where label in (
    'UX Design', 'Requirement Definition', 'Roadmap Planning',
    'AI UX', 'Responsive Design', 'Wireframing', 'Component Design'
  )
);

-- 4. 消す言葉を語彙から消す
delete from skills_vocab where label in (
  'UX Design', 'Requirement Definition', 'Roadmap Planning',
  'AI UX', 'Responsive Design', 'Wireframing', 'Component Design'
);

-- 5. 名前変更
update skills_vocab set label = 'Frontend'       where label = 'Frontend Development';
update skills_vocab set label = 'Accessibility'  where label = 'Web Accessibility';
update skills_vocab set label = 'Design Systems' where label = 'Design System';

-- 6. 新設（同じ言葉が既にあれば足さない）
insert into skills_vocab (label)
select v.label from (values ('Product Strategy'), ('Validation'), ('Education'), ('Planning')) as v(label)
where not exists (select 1 from skills_vocab s where s.label = v.label);

commit;

-- ── 確認（適用後に流す）──────────────────────────────────
-- A. 語彙: 次の 15 行が出れば OK
--    Accessibility / AI Integration / Design Systems / Education / Frontend / Planning /
--    Product Design / Product Management / Product Strategy / Project Management /
--    Prompt Design / Prototyping / UX Research / Validation / Visual Design
select label from skills_vocab order by label;

-- B. 作品ごとのタグ（本番のみ意味がある。dev は 0 行）
select w.title, string_agg(v.label, ', ' order by ws.sort_order) as tags
from works w
left join work_skills ws on ws.work_id = w.id
left join skills_vocab v on v.id = ws.skill_id
group by w.title, w.sort_order
order by w.sort_order;
