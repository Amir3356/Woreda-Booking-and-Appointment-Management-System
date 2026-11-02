-- Migration Rollback: 000001_create_appointments.down.sql
-- Service: appointment-service

DROP TABLE IF EXISTS appointments CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;

