-- Add career_lead column to profile for editable career section lead text
ALTER TABLE profile ADD COLUMN IF NOT EXISTS career_lead TEXT;
