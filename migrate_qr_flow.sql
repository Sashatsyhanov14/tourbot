-- Миграция: поддержка DB-based QR delivery flow
-- Вставь в Supabase SQL Editor и нажми Run

-- 1. Добавляем колонку assigned_manager (кто нажал "Отправить QR")
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_manager BIGINT;

-- 2. Обновляем CHECK constraint чтобы поддерживать 'awaiting_qr' статус
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'awaiting_qr', 'paid', 'cancelled'));
