-- Migration: 000001_create_users_and_settings.up.sql
-- Service: user-service (and auth-service)

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CITIZEN', 'OFFICER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    national_id VARCHAR(64) NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'CITIZEN',
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    counter_number INTEGER DEFAULT NULL CHECK (counter_number IS NULL OR counter_number > 0),
    address VARCHAR(255) DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_officer_department CHECK (
        (role = 'OFFICER' AND department_id IS NOT NULL) OR
        (role <> 'OFFICER')
    )
);

CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'primary',
    woreda_name VARCHAR(255) NOT NULL DEFAULT 'Woreda 03 Public Administration',
    city_region VARCHAR(255) NOT NULL DEFAULT 'Addis Ababa City Administration',
    hotline VARCHAR(32) NOT NULL DEFAULT '9840',
    reception_phone VARCHAR(32) NOT NULL DEFAULT '+251 11 551 0000',
    sms_gateway_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_approve_bookings BOOLEAN NOT NULL DEFAULT FALSE,
    advance_booking_days INTEGER NOT NULL DEFAULT 14,
    cancellation_cutoff_hours INTEGER NOT NULL DEFAULT 4,
    max_parallel_slots INTEGER NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);

