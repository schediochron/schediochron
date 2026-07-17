-- 0001 initial schema
--
-- The MVP schema for Schediochron. Every table and constraint here expresses a
-- model in @schediochron/core and the invariants its ADR fixes; deviations are
-- called out inline. Column names follow the models (snake_case at the wall).

-- Users — ADR-002 / models/user.ts.
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text        NOT NULL UNIQUE,
  display_name  text,
  email         text        UNIQUE, -- unique-when-present: Postgres allows many NULLs
  role          text        NOT NULL CHECK (role IN ('admin', 'member')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_format
    CHECK (char_length(username) BETWEEN 3 AND 50 AND username ~ '^[A-Za-z0-9_-]+$'),
  CONSTRAINT users_display_name_len
    CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 100),
  CONSTRAINT users_email_nonempty
    CHECK (email IS NULL OR char_length(email) >= 1)
);

-- Password credentials — deliberately a separate table, not a `users` column.
--
-- The User model and UserRepository (#126) are credential-free by design: ADR-002
-- fixes `passwordHash` as living "only in the persistence layer", never exposed,
-- and never a field on `User`. Putting the hash on `users` would make
-- `UserRepository.create(user: User)` unable to satisfy a NOT NULL column, since
-- nothing in `User` carries it. Splitting it out keeps UserRepository pure and
-- the hash NOT NULL where it is stored.
--
-- The auth layer (#29/#30) owns this table; UserRepository never touches it. A
-- user row may exist before its credential is written; registration writes both
-- in one transaction, and a user without a credential simply cannot authenticate.
CREATE TABLE user_credentials (
  user_id       uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  password_hash text        NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Teams — ADR-004 / models/team.ts.
CREATE TABLE teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team membership — the join table behind the two-array Team model.
--
-- A row is a membership; is_admin marks the admins among the members. This is
-- what makes `adminIds ⊆ memberIds` (ADR-004) structural rather than checked:
-- an admin *is* a member row, so it cannot be an admin without being a member.
-- `memberIds` = every row for the team; `adminIds` = rows where is_admin.
--
-- "At least one admin" (ADR-004) cannot be expressed as a row constraint and is
-- enforced by the Team repository (#28) inside the membership mutations.
CREATE TABLE team_members (
  team_id    uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  is_admin   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- Teams a user participates in — TeamRepository.findByUserId.
CREATE INDEX team_members_user_id ON team_members (user_id);

-- Time entries — ADR-001 / models/time-entry.ts.
--
-- No `duration` column: duration is computed on demand (core computeDuration).
-- No `date` column: the day is derived from start_time.
CREATE TABLE time_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time   timestamptz, -- null while running
  status     text        NOT NULL CHECK (status IN ('running', 'completed')),
  note       text        CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Invariant 1 (ADR-001): running ↔ end_time null, completed ↔ end_time set.
  CONSTRAINT time_entries_status_end_time CHECK (
    (status = 'running'   AND end_time IS NULL) OR
    (status = 'completed' AND end_time IS NOT NULL)
  ),
  -- Invariant 2 (ADR-001): a completed interval is non-empty, start < end.
  CONSTRAINT time_entries_interval CHECK (end_time IS NULL OR end_time > start_time)
);

-- One running entry per user (ADR-001). The database is the enforcement point:
-- a second clock-in raises a unique violation the repository maps to a 409.
CREATE UNIQUE INDEX time_entries_one_running_per_user
  ON time_entries (user_id) WHERE status = 'running';

-- Range and per-user lookups — TimeEntryRepository.find (from/to bound start_time).
CREATE INDEX time_entries_user_start ON time_entries (user_id, start_time);

-- Refresh tokens — ADR-003 / models/refresh-token.ts.
--
-- `token` holds the *hash* of the opaque token the client carries (#25 stores
-- hashed; the repository hashes on write and on lookup). It is the lookup key,
-- so it is the primary key. revoked_at null means live; logout and admin
-- password reset set it, and refresh answers 401 for a revoked or expired row.
CREATE TABLE refresh_tokens (
  token      text        PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Revoke-all-for-user — RefreshTokenRepository.revokeAllForUser.
CREATE INDEX refresh_tokens_user_id ON refresh_tokens (user_id);
