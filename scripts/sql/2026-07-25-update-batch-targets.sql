-- Migration: Add typing_type to batch_targets and make composite primary key
-- Run this in your Supabase SQL Editor:

ALTER TABLE batch_targets ADD COLUMN IF NOT EXISTS typing_type TEXT NOT NULL DEFAULT 'English';

-- Drop old primary key constraint if it exists (usually batch_targets_pkey)
ALTER TABLE batch_targets DROP CONSTRAINT IF EXISTS batch_targets_pkey;

-- Create composite primary key on (batch_name, typing_type)
ALTER TABLE batch_targets ADD PRIMARY KEY (batch_name, typing_type);
