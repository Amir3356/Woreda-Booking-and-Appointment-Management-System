-- Migration: 000001_create_appointments.up.sql
-- Service: appointment-service

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CHECKED_IN',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(64) PRIMARY KEY,
    reference_number VARCHAR(64) NOT NULL UNIQUE,
    citizen_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    citizen_name VARCHAR(255) NOT NULL,
    citizen_phone VARCHAR(32) NOT NULL,
    citizen_email VARCHAR(255),
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    service_id VARCHAR(64) NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(16) NOT NULL,
    status appointment_status NOT NULL DEFAULT 'PENDING',
    token_number VARCHAR(32) DEFAULT NULL,
    citizen_notes TEXT DEFAULT NULL,
    officer_notes TEXT DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    responsible_officer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_dept_date_status ON appointments(department_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_citizen_history ON appointments(citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_reference_number ON appointments(reference_number);
CREATE INDEX IF NOT EXISTS idx_active_bookings_slot ON appointments(service_id, appointment_date, time_slot) 
WHERE status NOT IN ('CANCELLED', 'REJECTED');

