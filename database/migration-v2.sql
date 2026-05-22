-- ============================================
-- Migration V2: Add sessions_per_week to courses
-- Run this against your Supabase database
-- ============================================

-- Add sessions_per_week column to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sessions_per_week INTEGER NOT NULL DEFAULT 2;
