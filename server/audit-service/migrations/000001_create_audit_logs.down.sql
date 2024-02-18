-- Migration Rollback: 000001_create_audit_logs.down.sql
-- Service: audit-service

DROP TABLE IF EXISTS audit_logs CASCADE;

