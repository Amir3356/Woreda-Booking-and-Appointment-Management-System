-- ==============================================================================
-- Woreda Booking & Appointment System - Database Seeds
-- Target Table: departments
-- Service: department-service
--
-- The seven Woreda departments. IDs match DEFAULT_DEPARTMENTS in client/context/store.js,
-- so services created from the Admin dashboard reference existing departments.
-- Safe to run more than once.
-- ==============================================================================

INSERT INTO departments (id, code, name, description, building_room, contact_phone, is_active) VALUES
    ('dept-1', 'KBL', 'Kebele Administration & Vital Events',
     'Citizen registration, residence identification, birth/marriage certificates, and neighborhood civil records.',
     'Building A, Ground Floor, Room 102', '+251 11 551 2341', TRUE),
    ('dept-2', 'LND', 'Land Administration & Urban Development',
     'Landholding rights documentation, residential plot verifications, property transfer oversight, and urban zoning.',
     'Building B, 2nd Floor, Room 204', '+251 11 551 8892', TRUE),
    ('dept-3', 'TRD', 'Trade, Industry & Enterprise Development',
     'Business registrations, commercial licenses, micro-enterprise support, and commercial practice verifications.',
     'Building A, 1st Floor, Room 115', '+251 11 551 4421', TRUE),
    ('dept-4', 'REV', 'Revenues & Tax Assessment',
     'Local tax assessment, business revenue verification, trade levy collections, and municipal tariff processing.',
     'Building B, Ground Floor, Room 108', '+251 11 551 7733', TRUE),
    ('dept-5', 'SOC', 'Social Affairs & Labor Welfare',
     'Social safety net enrollment, vulnerable community support, disability assistance, and pension documentation.',
     'Building C, 1st Floor, Room 105', '+251 11 551 6612', TRUE),
    ('dept-6', 'HLT', 'Public Health & Environmental Sanitation',
     'Community health verifications, sanitation inspections, food handler certificates, and hygiene permits.',
     'Building C, Ground Floor, Room 101', '+251 11 551 9901', TRUE),
    ('dept-7', 'AUD', 'Code Enforcement & Municipal Audit',
     'Building regulation enforcement, municipal code compliance, public land protection, and community grievance resolution.',
     'Building A, 2nd Floor, Room 210', '+251 11 551 3345', TRUE)
ON CONFLICT (id) DO NOTHING;
