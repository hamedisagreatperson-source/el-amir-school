-- ============================================
-- School Management Platform Database Schema
-- PostgreSQL (Supabase)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────
-- 1. ADMINS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(30) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 2. TEACHERS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(30) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 3. COURSES TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(50) NOT NULL,
  level VARCHAR(5) NOT NULL CHECK (level IN ('1AM','2AM','3AM','4AM','1AS','2AS','3AS')),
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  capacity INTEGER NOT NULL DEFAULT 20,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 4. SESSIONS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 5. STUDENTS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(30) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  parent_phone VARCHAR(20),
  email VARCHAR(100),
  level VARCHAR(5) NOT NULL CHECK (level IN ('1AM','2AM','3AM','4AM','1AS','2AS','3AS')),
  school_year VARCHAR(10) DEFAULT '2025-2026',
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','expelled','pending')),
  is_active BOOLEAN DEFAULT true,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 6. ATTENDANCE TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME,
  status VARCHAR(10) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note TEXT,
  recorded_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, course_id, session_date, session_time)
);

-- ──────────────────────────────────────────────
-- 7. PAYMENTS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid','pending_verification')),
  proof_url TEXT,
  verified_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, course_id, month)
);

-- ──────────────────────────────────────────────
-- 8. REQUESTS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_role VARCHAR(15) NOT NULL,
  from_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('expel_request','add_student','schedule_change','note_approval','other')),
  target_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  response TEXT,
  resolved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 9. NOTIFICATIONS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_id UUID NOT NULL,
  to_role VARCHAR(15) NOT NULL CHECK (to_role IN ('admin','super_admin','teacher','student')),
  type VARCHAR(30),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 10. AUDIT LOG TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL,
  actor_role VARCHAR(15) NOT NULL,
  actor_name VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 11. TEACHER NOTES TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 12. AUTH TOKENS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_role VARCHAR(15) NOT NULL,
  token_hash TEXT NOT NULL,
  jti VARCHAR(100) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_level ON students(level);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(session_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_requests_from ON requests(from_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_to ON notifications(to_id, to_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_jti ON auth_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_student ON teacher_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_teacher ON teacher_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);

-- ──────────────────────────────────────────────
-- RPC FUNCTIONS
-- ──────────────────────────────────────────────

-- Increment enrolled count
CREATE OR REPLACE FUNCTION increment_enrolled(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE courses SET enrolled_count = enrolled_count + 1, updated_at = NOW() WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement enrolled count
CREATE OR REPLACE FUNCTION decrement_enrolled(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE courses SET enrolled_count = GREATEST(enrolled_count - 1, 0), updated_at = NOW() WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────
-- SEED: Default Super Admin
-- ──────────────────────────────────────────────
-- Password: admin123 (bcrypt hash with 12 rounds)
-- Replace this hash with your own after first login
INSERT INTO admins (username, password, full_name, email, role, permissions)
VALUES (
  'admin',
  '$2a$12$LJ3/LPQ.v1lRyFP5fhI3nOPjVQdP5RX/9oY3L5JR6vSfBOqF0vQXq',
  'المدير الرئيسي',
  'admin@school.com',
  'super_admin',
  '{"manage_students": true, "manage_teachers": true, "manage_courses": true, "manage_payments": true, "send_emails": true}'
) ON CONFLICT (username) DO NOTHING;

-- ──────────────────────────────────────────────
-- STORAGE BUCKET (run in Supabase dashboard)
-- ──────────────────────────────────────────────
-- Create a bucket named 'payment-proofs' in the Supabase dashboard
-- Set it as public or configure appropriate RLS policies

-- ──────────────────────────────────────────────
-- ROW LEVEL SECURITY (optional, for extra security)
-- ──────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_notes ENABLE ROW LEVEL SECURITY;

-- Note: Since we're using service_role key on the backend,
-- RLS won't affect backend queries. These policies are for
-- direct Supabase client access if needed in the future.
