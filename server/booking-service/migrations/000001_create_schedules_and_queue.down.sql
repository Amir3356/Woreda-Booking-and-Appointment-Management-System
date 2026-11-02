-- Migration Rollback: 000001_create_schedules_and_queue.down.sql
-- Service: booking-service

DROP TABLE IF EXISTS queue_tokens CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TYPE IF EXISTS queue_status CASCADE;
DROP TYPE IF EXISTS schedule_status CASCADE;

