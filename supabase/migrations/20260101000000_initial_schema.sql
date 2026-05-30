-- Initial schema: all tables (source of truth: src/types/supabase.ts)
-- career_lead is intentionally omitted here; added by 20260322000000_add_profile_career_lead.sql

CREATE TABLE IF NOT EXISTS profile (
  id         BIGSERIAL PRIMARY KEY,
  name_jp    TEXT        NOT NULL DEFAULT '',
  name_en    TEXT        NOT NULL DEFAULT '',
  title      TEXT        NOT NULL DEFAULT '',
  bio        TEXT        NOT NULL DEFAULT '',
  hero_image_url TEXT    NOT NULL DEFAULT '',
  introduction   JSONB   NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company     TEXT        NOT NULL DEFAULT '',
  role        TEXT        NOT NULL DEFAULT '',
  period      TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_level_tokens (
  key               TEXT    PRIMARY KEY,
  value             TEXT    NOT NULL DEFAULT '',
  mode              TEXT    NOT NULL DEFAULT '',
  description       TEXT    NOT NULL DEFAULT '',
  scopes            TEXT[],
  figma_type        TEXT,
  figma_variable_id TEXT,
  is_override       BOOLEAN DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  category      TEXT,
  period        TEXT,
  role          TEXT,
  sections      JSONB,
  sort_order    INTEGER,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills_vocab (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT        NOT NULL,
  label_short TEXT,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tools_vocab (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_skills (
  project_id UUID        NOT NULL,
  skill_id   UUID        NOT NULL,
  sort_order INTEGER,
  PRIMARY KEY (project_id, skill_id),
  CONSTRAINT project_skills_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT project_skills_skill_id_fkey
    FOREIGN KEY (skill_id)   REFERENCES skills_vocab (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_tools (
  project_id UUID        NOT NULL,
  tool_id    UUID        NOT NULL,
  sort_order INTEGER,
  PRIMARY KEY (project_id, tool_id),
  CONSTRAINT project_tools_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT project_tools_tool_id_fkey
    FOREIGN KEY (tool_id)    REFERENCES tools_vocab (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS skill_cards (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  title_jp   TEXT        NOT NULL,
  icon_set   TEXT        NOT NULL DEFAULT '',
  icon_name  TEXT        NOT NULL DEFAULT '',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_experience (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID    NOT NULL,
  label       TEXT    NOT NULL,
  label_short TEXT,
  level       TEXT    NOT NULL,
  segments    INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  CONSTRAINT skill_experience_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES skill_cards (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS skill_tools (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID    NOT NULL,
  name       TEXT    NOT NULL,
  years      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT skill_tools_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES skill_cards (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_skills (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT        NOT NULL,
  strategy             INTEGER,
  ia                   INTEGER,
  interaction          INTEGER,
  visual               INTEGER,
  prototype            INTEGER,
  implementation       INTEGER,
  qualitative_research INTEGER,
  quantitative_research INTEGER,
  writing              INTEGER,
  facilitation         INTEGER,
  presentation         INTEGER,
  accessibility        INTEGER,
  is_target            BOOLEAN,
  updated_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS todos (
  id         BIGSERIAL   PRIMARY KEY,
  title      TEXT        NOT NULL,
  contents   TEXT,
  start_date TEXT,
  end_date   TEXT
);
