-- Online Exam System: strict single-attempt timed exams, batch-targeted.
--
-- exam_attempts rows are inserted the moment a student's exam-fetch first
-- succeeds (started_at = now(), stats left null), then updated in place at
-- submission. This makes the unique(exam_id, student_id) constraint the
-- actual enforcement point for "no retakes" from the earliest possible
-- moment (mirrors the race-safe unique-index pattern in
-- 2026-07-23-unique-constraints.sql — the app catches a Postgres
-- unique-violation rather than trusting an app-level check-then-insert) and
-- gives refresh-survival almost for free: on reload, the fetch endpoint
-- finds the existing row and computes remaining time from started_at
-- instead of resetting a fresh countdown.
--
-- Run this once in the Supabase SQL editor for this project.

create table if not exists exams (
  id text primary key,
  title text not null,
  batch_name text not null,
  language text not null,
  category text not null,
  duration_seconds integer not null,
  text_content text not null,
  points integer not null default 0,
  deadline timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_exams_batch_name on exams (batch_name);

create table if not exists exam_attempts (
  id text primary key,
  exam_id text not null references exams(id) on delete cascade,
  student_id text not null references users(id) on delete cascade,
  wpm double precision,
  raw_wpm double precision,
  accuracy double precision,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (exam_id, student_id)
);

create index if not exists idx_exam_attempts_exam_id on exam_attempts (exam_id);
