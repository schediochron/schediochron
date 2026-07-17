-- Reverses 0001_initial_schema.up.sql. Dropped in reverse dependency order;
-- CASCADE also removes the indexes and constraints created above.
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS time_entries;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS user_credentials;
DROP TABLE IF EXISTS users;
