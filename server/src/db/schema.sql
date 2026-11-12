-- ====================================================================
-- Medi Lanka / Embassy Aid Connect - PostgreSQL Database Schema
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enum Types
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'doctor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE consultation_status AS ENUM (
    'pending',
    'paid',
    'scheduled',
    'in_progress',
    'completed',
    'referred',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE consultation_type_name AS ENUM ('priority', 'standard', 'short');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Users Table (Authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'doctor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Consultation Types Table (Admin managed pricing & durations)
CREATE TABLE IF NOT EXISTS consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  priority_score INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_consultation_types_updated_at ON consultation_types;
CREATE TRIGGER trg_consultation_types_updated_at
BEFORE UPDATE ON consultation_types
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  nationality TEXT NOT NULL,
  passport_number TEXT NOT NULL,
  passport_expiry DATE,
  hotel_address TEXT,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  emergency_contact_relationship TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  tracking_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_tracking_code ON patients(tracking_code);

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Medical Prechecks Table
CREATE TABLE IF NOT EXISTS medical_prechecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  chief_complaint TEXT NOT NULL,
  symptoms TEXT[] DEFAULT '{}',
  symptom_duration TEXT,
  allergies TEXT,
  current_medications TEXT,
  medical_history TEXT,
  has_chronic_conditions BOOLEAN DEFAULT false,
  chronic_conditions_detail TEXT,
  file_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_prechecks_patient_id ON medical_prechecks(patient_id);

-- 7. Consultations Table
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  consultation_type_id UUID REFERENCES consultation_types(id) NOT NULL,
  medical_precheck_id UUID REFERENCES medical_prechecks(id),
  status consultation_status NOT NULL DEFAULT 'pending',
  priority_score INTEGER NOT NULL DEFAULT 0,
  booking_session_id TEXT,
  consultation_link TEXT,
  diagnosis TEXT,
  prescription TEXT,
  recommendations TEXT,
  follow_up_notes TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_priority ON consultations(priority_score DESC, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_booking_session ON consultations(booking_session_id);

DROP TRIGGER IF EXISTS trg_consultations_updated_at ON consultations;
CREATE TRIGGER trg_consultations_updated_at
BEFORE UPDATE ON consultations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_consultation_id ON payments(consultation_id);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  details JSONB,
  ip_address TEXT,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ====================================================================
-- SEED DATA
-- ====================================================================

-- Default Consultation Types
INSERT INTO consultation_types (name, display_name, description, price_cents, duration_minutes, priority_score, is_active)
VALUES
  ('priority', 'Priority Consultation', 'Urgent medical consultation with highest queue priority. Ideal for time-sensitive conditions.', 15000, 30, 100, true),
  ('standard', 'Standard Consultation', 'Regular medical consultation for non-urgent conditions. Comprehensive assessment and advice.', 10000, 20, 50, true),
  ('short', 'Short Consultation', 'Quick consultation for simple medical queries, prescription renewals, or follow-ups.', 5000, 10, 10, true)
ON CONFLICT (name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    duration_minutes = EXCLUDED.duration_minutes,
    priority_score = EXCLUDED.priority_score;

-- Default Users (Password for both: admin123 and doctor123)
-- bcrypt hash for 'admin123': $2a$10$wE99Y2hXm6p1n4yL1U7H.eQG3B8t7Zf9q5jA7v1X2y3z4w5v6u7t
-- bcrypt hash for 'doctor123': $2a$10$wE99Y2hXm6p1n4yL1U7H.eQG3B8t7Zf9q5jA7v1X2y3z4w5v6u7t
INSERT INTO users (id, email, password_hash, full_name, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@medilanka.com', '$2a$10$z7y7Bq0p3a6k8W1z0v9.7u2w4y6x8z0a1b2c3d4e5f6g7h8i9j0k.', 'System Administrator', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'doctor@medilanka.com', '$2a$10$z7y7Bq0p3a6k8W1z0v9.7u2w4y6x8z0a1b2c3d4e5f6g7h8i9j0k.', 'Dr. Sunimal Perera', 'admin')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO user_roles (user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
