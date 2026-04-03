-- Add note column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS note TEXT;
