-- ============================================================================
-- Baseline schema (source of truth: prod project kljlxjlbetaxhtxqzrdc)
-- 2026-05-31 reconstruction. Replaces the previous 2 ad-hoc migrations.
--
-- 目標形（10テーブル）。todos / user_skills / skill_level_tokens は
-- 後続 20260531120100_drop_unused_tables.sql で削除されるため含めない。
--
-- 冪等化（CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS）してあり、
-- 既存DB（prod/dev）への再適用でも安全。新規環境では fresh セットアップになる。
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile (
  id             integer     PRIMARY KEY DEFAULT 1,
  name_jp        text        NOT NULL DEFAULT '',
  name_en        text        NOT NULL DEFAULT '',
  title          text        NOT NULL DEFAULT '',
  bio            text        NOT NULL DEFAULT '',
  hero_image_url text        NOT NULL DEFAULT '',
  introduction   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at     timestamptz DEFAULT now(),
  career_lead    text
);

CREATE TABLE IF NOT EXISTS public.career_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role        text        NOT NULL DEFAULT '',
  company     text        NOT NULL DEFAULT '',
  period      text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  category      text,
  thumbnail_url text,
  role          text,
  period        text,
  sections      jsonb       DEFAULT '[]'::jsonb,
  sort_order    integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skills_vocab (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text        NOT NULL,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  label_short text
);

CREATE TABLE IF NOT EXISTS public.tools_vocab (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skill_cards (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  title_jp   text        NOT NULL,
  icon_set   text        NOT NULL DEFAULT 'Edit',
  icon_name  text        NOT NULL DEFAULT 'writing-fluently',
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_skills (
  project_id uuid    NOT NULL REFERENCES public.projects(id)     ON DELETE CASCADE,
  skill_id   uuid    NOT NULL REFERENCES public.skills_vocab(id) ON DELETE RESTRICT,
  sort_order integer,
  PRIMARY KEY (project_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.project_tools (
  project_id uuid    NOT NULL REFERENCES public.projects(id)    ON DELETE CASCADE,
  tool_id    uuid    NOT NULL REFERENCES public.tools_vocab(id) ON DELETE RESTRICT,
  sort_order integer,
  PRIMARY KEY (project_id, tool_id)
);

CREATE TABLE IF NOT EXISTS public.skill_experience (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid    NOT NULL REFERENCES public.skill_cards(id) ON DELETE CASCADE,
  label       text    NOT NULL,
  segments    integer NOT NULL CHECK (segments >= 1 AND segments <= 10),
  level       text    NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  label_short text
);

CREATE TABLE IF NOT EXISTS public.skill_tools (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid    NOT NULL REFERENCES public.skill_cards(id) ON DELETE CASCADE,
  name       text    NOT NULL,
  years      text    NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- prod と同等のポリシーを付与（dev は元々 RLS 無効だったため本 baseline で是正）。
-- 注: 現行 prod のポリシーは anon に広い権限を与えている（運用実態の踏襲）。

ALTER TABLE public.profile          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills_vocab     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools_vocab      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_cards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_skills   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tools    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_tools      ENABLE ROW LEVEL SECURITY;

-- profile
DROP POLICY IF EXISTS "anon_all" ON public.profile;
CREATE POLICY "anon_all" ON public.profile AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon can upsert profile" ON public.profile;
CREATE POLICY "anon can upsert profile" ON public.profile AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- career_items
DROP POLICY IF EXISTS "anon_all" ON public.career_items;
CREATE POLICY "anon_all" ON public.career_items AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon full access career_items" ON public.career_items;
CREATE POLICY "anon full access career_items" ON public.career_items AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- projects
DROP POLICY IF EXISTS "Allow public read" ON public.projects;
CREATE POLICY "Allow public read" ON public.projects AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "anon full access projects" ON public.projects;
CREATE POLICY "anon full access projects" ON public.projects AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- skills_vocab
DROP POLICY IF EXISTS "public read skills_vocab" ON public.skills_vocab;
CREATE POLICY "public read skills_vocab" ON public.skills_vocab AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write skills_vocab" ON public.skills_vocab;
CREATE POLICY "auth write skills_vocab" ON public.skills_vocab AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon full access skills_vocab" ON public.skills_vocab;
CREATE POLICY "anon full access skills_vocab" ON public.skills_vocab AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- tools_vocab
DROP POLICY IF EXISTS "public read tools_vocab" ON public.tools_vocab;
CREATE POLICY "public read tools_vocab" ON public.tools_vocab AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write tools_vocab" ON public.tools_vocab;
CREATE POLICY "auth write tools_vocab" ON public.tools_vocab AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon full access tools_vocab" ON public.tools_vocab;
CREATE POLICY "anon full access tools_vocab" ON public.tools_vocab AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- project_skills
DROP POLICY IF EXISTS "public read project_skills" ON public.project_skills;
CREATE POLICY "public read project_skills" ON public.project_skills AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write project_skills" ON public.project_skills;
CREATE POLICY "auth write project_skills" ON public.project_skills AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon full access project_skills" ON public.project_skills;
CREATE POLICY "anon full access project_skills" ON public.project_skills AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- project_tools
DROP POLICY IF EXISTS "public read project_tools" ON public.project_tools;
CREATE POLICY "public read project_tools" ON public.project_tools AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write project_tools" ON public.project_tools;
CREATE POLICY "auth write project_tools" ON public.project_tools AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon full access project_tools" ON public.project_tools;
CREATE POLICY "anon full access project_tools" ON public.project_tools AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- skill_cards
DROP POLICY IF EXISTS "public read skill_cards" ON public.skill_cards;
CREATE POLICY "public read skill_cards" ON public.skill_cards AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write skill_cards" ON public.skill_cards;
CREATE POLICY "auth write skill_cards" ON public.skill_cards AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "anon full access skill_cards" ON public.skill_cards;
CREATE POLICY "anon full access skill_cards" ON public.skill_cards AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- skill_experience （ポリシー名は旧 skill_bars 由来を踏襲）
DROP POLICY IF EXISTS "public read skill_bars" ON public.skill_experience;
CREATE POLICY "public read skill_bars" ON public.skill_experience AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write skill_bars" ON public.skill_experience;
CREATE POLICY "auth write skill_bars" ON public.skill_experience AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "anon full access skill_experience" ON public.skill_experience;
CREATE POLICY "anon full access skill_experience" ON public.skill_experience AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);

-- skill_tools
DROP POLICY IF EXISTS "public read skill_tools" ON public.skill_tools;
CREATE POLICY "public read skill_tools" ON public.skill_tools AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth write skill_tools" ON public.skill_tools;
CREATE POLICY "auth write skill_tools" ON public.skill_tools AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "anon full access skill_tools" ON public.skill_tools;
CREATE POLICY "anon full access skill_tools" ON public.skill_tools AS PERMISSIVE FOR ALL TO anon USING (true) WITH CHECK (true);
