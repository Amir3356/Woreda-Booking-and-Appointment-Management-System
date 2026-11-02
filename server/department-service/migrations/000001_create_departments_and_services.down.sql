-- Migration Rollback: 000001_create_departments_and_services.down.sql
-- Service: department-service

DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

