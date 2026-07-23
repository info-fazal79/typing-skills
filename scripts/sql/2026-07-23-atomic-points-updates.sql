-- Atomic points/stats updates, replacing the app-level "select current value,
-- compute in JS, write it back" pattern used by practice/save, tasks/submit,
-- and the inactivity-penalty job. That pattern is a lost-update race under
-- concurrent requests for the same user (two tabs, a retried request, etc.):
-- both reads see the same starting value and the second write clobbers the
-- first. Each function below does the read+compute+write as a single SQL
-- statement, so Postgres's own row-level locking makes it atomic.
--
-- Run this once in the Supabase SQL editor for this project.

create or replace function record_practice_session_stats(
  p_user_id uuid,
  p_points_delta integer,
  p_wpm numeric
) returns table (
  points integer,
  best_wpm numeric,
  avg_wpm numeric,
  session_count integer
) as $$
  update users
  set
    points = coalesce(points, 0) + p_points_delta,
    best_wpm = greatest(coalesce(best_wpm, 0), p_wpm),
    total_wpm_sum = coalesce(total_wpm_sum, 0) + p_wpm,
    session_count = coalesce(session_count, 0) + 1,
    avg_wpm = round((coalesce(total_wpm_sum, 0) + p_wpm) / (coalesce(session_count, 0) + 1)),
    updated_at = now()
  where id = p_user_id
  returning users.points, users.best_wpm, users.avg_wpm, users.session_count;
$$ language sql;

create or replace function award_task_points(
  p_user_id uuid,
  p_points_delta integer
) returns table (
  points integer
) as $$
  update users
  set
    points = coalesce(points, 0) + p_points_delta,
    updated_at = now()
  where id = p_user_id
  returning users.points;
$$ language sql;

create or replace function apply_penalty_deduction(
  p_user_id uuid,
  p_deduction integer,
  p_checked_at timestamptz
) returns void as $$
  update users
  set
    points = greatest(0, coalesce(points, 0) - p_deduction),
    last_penalty_check = p_checked_at
  where id = p_user_id;
$$ language sql;
