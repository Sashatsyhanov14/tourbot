-- =============================================
-- Excursion Bot — Database Schema
-- =============================================

-- Очистка старых таблиц
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS excursions CASCADE;
DROP TABLE IF EXISTS faq CASCADE;

-- 1. Excursions table (вместо tariffs)
CREATE TABLE excursions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_number INTEGER,                         -- Порядок отображения
    city TEXT NOT NULL,                          -- Город (Москва, Санкт-Петербург, Сочи...)
    title TEXT NOT NULL,                         -- Название экскурсии
    description TEXT NOT NULL,                   -- Описание (что увидит клиент)
    price_rub DECIMAL(10, 2) NOT NULL,           -- Цена в рублях
    duration TEXT NOT NULL,                      -- Длительность (3 часа, целый день)
    included TEXT,                               -- Что включено (трансфер, гид, обед...)
    meeting_point TEXT,                          -- Место встречи / примечание
    image_url TEXT,                              -- Фото экскурсии
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Users table (с реферальной системой)
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    referrer_id BIGINT REFERENCES users(telegram_id),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'founder', 'manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Chat History table
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Requests table (вместо orders) — заявки клиентов
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    excursion_id UUID REFERENCES excursions(id),
    excursion_title TEXT,                        -- Сохраняем название на момент заявки
    full_name TEXT NOT NULL,                     -- ФИО клиента
    tour_date TEXT NOT NULL,                     -- Желаемая дата (текст)
    hotel_name TEXT NOT NULL,                    -- Отель / место откуда забрать
    price_rub DECIMAL(10, 2),                    -- Цена на момент заявки
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'done', 'cancelled')),
    assigned_manager BIGINT,                     -- ID менеджера, принявшего заявку
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. FAQ / Knowledge Base table
CREATE TABLE faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic TEXT NOT NULL,
    content_ru TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_users_referrer ON users(referrer_id);
CREATE INDEX idx_chat_history_user ON chat_history(user_id);
CREATE INDEX idx_requests_user ON requests(user_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_excursions_city ON excursions(city);
