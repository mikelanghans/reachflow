-- ─── ReachFlow Database Schema ───────────────────────────────────────────────
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── AGENCIES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL DEFAULT 'My Agency',
  brand_name            TEXT,
  brand_color           TEXT DEFAULT '#2dce98',
  brand_logo_url        TEXT,
  brand_tagline         TEXT DEFAULT 'Agency Console',
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  plan                  TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','agency_plus')),
  daily_send_limit      INTEGER DEFAULT 20,
  send_days             JSONB DEFAULT '[1,2,3,4]'::jsonb,
  send_start            TEXT DEFAULT '08:00',
  send_end              TEXT DEFAULT '17:00',
  timing_preset         TEXT DEFAULT 'saas',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CLIENTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id             UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  initials              TEXT,
  color                 TEXT DEFAULT '#58a6ff',
  active                BOOLEAN DEFAULT TRUE,
  icp                   JSONB DEFAULT '{}'::jsonb,
  sequence              JSONB DEFAULT '[]'::jsonb,
  unipile_account_id    TEXT,
  linkedin_connected    BOOLEAN DEFAULT FALSE,
  linkedin_email        TEXT,
  messages_count        INTEGER DEFAULT 0,
  replies_count         INTEGER DEFAULT 0,
  meetings_count        INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  channel         TEXT NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin','email','linkedin + email')),
  flow            JSONB DEFAULT '[]'::jsonb,
  review_mode     BOOLEAN DEFAULT FALSE,
  leads_count     INTEGER DEFAULT 0,
  sent_count      INTEGER DEFAULT 0,
  replies_count   INTEGER DEFAULT 0,
  meetings_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LEADS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id             UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  campaign_id           UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  title                 TEXT,
  company               TEXT,
  linkedin_url          TEXT,
  linkedin_urn          TEXT,
  email                 TEXT,
  initials              TEXT,
  color                 TEXT DEFAULT '#7d8590',
  pipeline_stage        TEXT NOT NULL DEFAULT 'prospecting' CHECK (pipeline_stage IN ('prospecting','contacted','engaged','converted')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','replied','meeting')),
  unread                BOOLEAN DEFAULT FALSE,
  unipile_profile_id    TEXT,
  trigger_keyword       TEXT,
  trigger_post          TEXT,
  days_in_stage         INTEGER DEFAULT 0,
  last_activity_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MESSAGES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agency_id           UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('in','out')),
  body                TEXT NOT NULL,
  channel             TEXT NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin','email')),
  unipile_message_id  TEXT UNIQUE,
  intent              TEXT,
  intent_confidence   TEXT,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── REVIEW QUEUE ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
  message_type    TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'linkedin',
  message_body    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  scheduled_for   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  meta        JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SUPPRESSIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppressions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  company     TEXT,
  reason      TEXT,
  method      TEXT NOT NULL DEFAULT 'auto-detected',
  campaign    TEXT,
  client      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, email)
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Enable RLS on every table
ALTER TABLE agencies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppressions  ENABLE ROW LEVEL SECURITY;

-- Helper function: returns the agency_id for the current logged-in user
CREATE OR REPLACE FUNCTION auth_agency_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT agency_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- RLS policies — each table can only be accessed by the owning agency
CREATE POLICY "agency_isolation" ON agencies      USING (id = auth_agency_id());
CREATE POLICY "agency_isolation" ON users         USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON clients       USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON campaigns     USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON leads         USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON messages      USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON review_queue  USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON activity_log  USING (agency_id = auth_agency_id());
CREATE POLICY "agency_isolation" ON suppressions  USING (agency_id = auth_agency_id());

-- INSERT policies (needed separately in Supabase)
CREATE POLICY "agency_insert" ON clients       WITH CHECK (agency_id = auth_agency_id());
CREATE POLICY "agency_insert" ON campaigns     WITH CHECK (agency_id = auth_agency_id());
CREATE POLICY "agency_insert" ON leads         WITH CHECK (agency_id = auth_agency_id());
CREATE POLICY "agency_insert" ON messages      WITH CHECK (agency_id = auth_agency_id());
CREATE POLICY "agency_insert" ON review_queue  WITH CHECK (agency_id = auth_agency_id());
CREATE POLICY "agency_insert" ON activity_log  WITH CHECK (agency_id = auth_agency_id());
CREATE POLICY "agency_insert" ON suppressions  WITH CHECK (agency_id = auth_agency_id());

-- ─── AUTO-CREATE AGENCY + USER ON SIGNUP ─────────────────────────────────────
-- This trigger fires whenever a new auth.users row is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_agency_id UUID;
BEGIN
  -- Create a new agency for this user
  INSERT INTO agencies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency'))
  RETURNING id INTO new_agency_id;

  -- Create the user profile linked to that agency
  INSERT INTO users (id, agency_id, email, full_name, role)
  VALUES (
    NEW.id,
    new_agency_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'admin'
  );

  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ─── UPDATED_AT TIMESTAMPS ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER agencies_updated_at  BEFORE UPDATE ON agencies  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated_at   BEFORE UPDATE ON clients   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER leads_updated_at     BEFORE UPDATE ON leads     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
