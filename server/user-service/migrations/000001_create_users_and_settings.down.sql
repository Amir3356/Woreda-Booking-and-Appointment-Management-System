-- Migration Rollback: 000001_create_users_and_settings.down.sql
-- Service: user-service

DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

