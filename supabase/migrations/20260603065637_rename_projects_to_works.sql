-- Projects → Works 完全統一（テーブル・カラム・制約・インデックス・RLS ポリシー）。
-- UI/コードに続き DB 物理名も works に統一し、長期運用での名称混同を解消する。

-- テーブル名
alter table public.projects rename to works;
alter table public.project_skills rename to work_skills;
alter table public.project_tools rename to work_tools;

-- 結合テーブルの FK カラム project_id -> work_id
alter table public.work_skills rename column project_id to work_id;
alter table public.work_tools rename column project_id to work_id;

-- 制約名（PK の rename は backing index も同時に rename）
alter table public.works rename constraint projects_pkey to works_pkey;
alter table public.works rename constraint projects_career_item_id_fkey to works_career_item_id_fkey;
alter table public.work_skills rename constraint project_skills_pkey to work_skills_pkey;
alter table public.work_skills rename constraint project_skills_project_id_fkey to work_skills_work_id_fkey;
alter table public.work_skills rename constraint project_skills_skill_id_fkey to work_skills_skill_id_fkey;
alter table public.work_tools rename constraint project_tools_pkey to work_tools_pkey;
alter table public.work_tools rename constraint project_tools_project_id_fkey to work_tools_work_id_fkey;
alter table public.work_tools rename constraint project_tools_tool_id_fkey to work_tools_tool_id_fkey;

-- インデックス
alter index public.idx_projects_career_item_id rename to idx_works_career_item_id;

-- RLS ポリシー
alter policy "Allow public read" on public.works rename to "works public read";
alter policy "anon full access projects" on public.works rename to "anon full access works";
alter policy "public read project_skills" on public.work_skills rename to "public read work_skills";
alter policy "anon full access project_skills" on public.work_skills rename to "anon full access work_skills";
alter policy "auth write project_skills" on public.work_skills rename to "auth write work_skills";
alter policy "public read project_tools" on public.work_tools rename to "public read work_tools";
alter policy "anon full access project_tools" on public.work_tools rename to "anon full access work_tools";
alter policy "auth write project_tools" on public.work_tools rename to "auth write work_tools";
