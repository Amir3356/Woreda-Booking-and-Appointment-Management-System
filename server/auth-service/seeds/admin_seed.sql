-- ==============================================================================
-- Woreda Booking & Appointment System - Database Seeds
-- Target Table: users
-- Service: user-service / auth-service
-- ==============================================================================
-- Administrator Credentials:
--   Email:    amirsiraj1995@gmail.com
--   Password: AEHJSS36
--   Role:     ADMIN (Central Administrator)
-- ==============================================================================

INSERT INTO users (
    id,
    full_name,
    email,
    phone,
    password_hash,
    national_id,
    role,
    department_id,
    is_active
)
VALUES (
    'usr-admin',
    'Amir Siraj',
    'amirsiraj1995@gmail.com',
    '+251911223344',
    '$2a$10$1MEQHYyfCdcr6deVZodQ0unZDCde5oxlwvugEzGHv1iRtPdaFeFUO', -- Bcrypt hash of 'AEHJSS36'
    'ET-ADM-9901',
    'ADMIN',
    NULL,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = 'ADMIN',
    is_active = TRUE;

