-- Migration: 000001_create_schedules_and_queue.up.sql
-- Service: booking-service

DO $$ BEGIN
    CREATE TYPE schedule_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE queue_status AS ENUM ('WAITING', 'SERVING', 'COMPLETED', 'NO_SHOW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(64) PRIMARY KEY,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    service_id VARCHAR(64) REFERENCES services(id) ON DELETE SET NULL,
    working_days JSONB NOT NULL DEFAULT '["Mon", "Tue", "Wed", "Thu", "Fri"]'::jsonb,
    opening_time TIME NOT NULL DEFAULT '08:30:00',
    closing_time TIME NOT NULL DEFAULT '17:30:00',
    daily_capacity INTEGER NOT NULL DEFAULT 40 CHECK (daily_capacity > 0),
    effective_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_end_date DATE,
    status schedule_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_schedule_hours CHECK (closing_time > opening_time),
    CONSTRAINT chk_effective_dates CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

CREATE TABLE IF NOT EXISTS queue_tokens (
    id VARCHAR(64) PRIMARY KEY,
    appointment_id VARCHAR(64) NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    token_number VARCHAR(32) NOT NULL,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    counter_number INTEGER NOT NULL DEFAULT 1,
    officer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    status queue_status NOT NULL DEFAULT 'WAITING',
    checked_in_time TIME NOT NULL DEFAULT CURRENT_TIME,
    called_time TIME DEFAULT NULL,
    estimated_minutes_remaining INTEGER NOT NULL DEFAULT 15,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedules_department_id ON schedules(department_id);
CREATE INDEX IF NOT EXISTS idx_queue_tokens_dept_date_status ON queue_tokens(department_id, queue_date, status);
CREATE INDEX IF NOT EXISTS idx_queue_tokens_token_number ON queue_tokens(token_number);

