-- Registration currently checks "is this email/roll number already taken?"
-- with a SELECT before the INSERT, in application code. Two concurrent
-- registrations for the same email or the same roll-number-in-batch can both
-- pass that check before either INSERT lands, creating duplicates. These
-- indexes make Postgres itself the source of truth, closing the race —
-- register/route.ts now catches the resulting unique-violation and returns
-- the same friendly error it already returns for the non-race case.
--
-- Run this once in the Supabase SQL editor for this project. If it fails
-- with a duplicate-key error, there are already-existing duplicate rows to
-- clean up by hand first.

create unique index if not exists idx_users_email_unique on users (email);

create unique index if not exists idx_users_batch_roll_unique
  on users (batch_name, roll_number)
  where role = 'STUDENT';
