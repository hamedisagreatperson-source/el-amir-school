-- ============================================
-- Migration Script: Update existing schema
-- Run this in Supabase SQL Editor if you already
-- created tables from the old schema.sql
-- ============================================

-- 1. Password column is kept as password_hash (no rename needed)

-- 2. (school_year and is_active removed — status column is sufficient)

-- 3. Add teacher_id to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON sessions(teacher_id);

-- 4. Add recorded_by to attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES teachers(id) ON DELETE SET NULL;

-- 5. Update attendance unique constraint (add session_time)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_course_id_session_date_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_course_id_session_date_session_time_key
  UNIQUE (student_id, course_id, session_date, session_time);

-- 6. Add notes to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 7. Recreate requests table with from_role/from_id instead of teacher_id
-- First drop old indexes
DROP INDEX IF EXISTS idx_requests_teacher;

-- Add new columns
ALTER TABLE requests ADD COLUMN IF NOT EXISTS from_role VARCHAR(15);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS from_id UUID;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

-- Migrate existing data (teacher_id → from_id, set from_role = 'teacher')
UPDATE requests SET from_role = 'teacher', from_id = teacher_id WHERE from_id IS NULL AND teacher_id IS NOT NULL;

-- Make columns NOT NULL after migration
ALTER TABLE requests ALTER COLUMN from_role SET NOT NULL;
ALTER TABLE requests ALTER COLUMN from_id SET NOT NULL;

-- Drop old column
ALTER TABLE requests DROP COLUMN IF EXISTS teacher_id;

CREATE INDEX IF NOT EXISTS idx_requests_from ON requests(from_id);

-- 8. Recreate notifications table with to_id/to_role instead of user_id/user_role
-- Drop old indexes
DROP INDEX IF EXISTS idx_notifications_user;

-- Rename columns
ALTER TABLE notifications RENAME COLUMN user_id TO to_id;
ALTER TABLE notifications RENAME COLUMN user_role TO to_role;

-- Add type column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(30);

-- Drop and recreate check constraint for renamed column
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_role_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_to_role_check
  CHECK (to_role IN ('admin','super_admin','teacher','student'));

CREATE INDEX IF NOT EXISTS idx_notifications_to ON notifications(to_id, to_role);

-- 9. Make auth_tokens.jti nullable
ALTER TABLE auth_tokens ALTER COLUMN jti DROP NOT NULL;

-- 10. Update RPC functions to use 'cid' parameter name
CREATE OR REPLACE FUNCTION increment_enrolled(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE courses SET enrolled_count = enrolled_count + 1, updated_at = NOW() WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_enrolled(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE courses SET enrolled_count = GREATEST(enrolled_count - 1, 0), updated_at = NOW() WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. (No-op: password_hash column kept as-is)
