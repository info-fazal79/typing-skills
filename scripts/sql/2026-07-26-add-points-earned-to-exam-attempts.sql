-- SQL Migration: Add points_earned to exam_attempts table
-- Run this in your Supabase SQL Editor:

ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0;
