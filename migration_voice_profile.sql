-- migration_voice_profile.sql
-- Adds the agency voice/tone profile used to personalize AI-generated outreach messages.
-- Run this in Supabase SQL Editor (existing agencies table already has rows, so we use
-- ALTER TABLE rather than relying on the CREATE TABLE default).

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS voice_profile JSONB
  DEFAULT '{"tone":"","doList":[],"dontList":[],"sampleMessages":[],"description":""}'::jsonb;

-- Backfill any existing rows that have NULL instead of the default
UPDATE agencies
SET voice_profile = '{"tone":"","doList":[],"dontList":[],"sampleMessages":[],"description":""}'::jsonb
WHERE voice_profile IS NULL;
