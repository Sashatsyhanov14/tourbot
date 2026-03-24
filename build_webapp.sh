#!/bin/bash

echo "🚀 Умная сборка Мини-Аппа запущена..."

# Ищем где у бота лежат секретные ключи ключи (обычно в bot/.env или в корне)
ENV_FILE=""
if [ -f "bot/.env" ]; then
    ENV_FILE="bot/.env"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if [ -z "$ENV_FILE" ]; then
    echo "❌ ОШИБКА: Файл .env с ключами не найден на сервере! Бот не знает данных Supabase."
    exit 1
fi

echo "✅ Нашел ключи от базы в $ENV_FILE. Копирую их для фронтенда..."

# Извлекаем ключи
DB_URL=$(grep "SUPABASE_URL" "$ENV_FILE" | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
DB_KEY=$(grep "SUPABASE_ANON_KEY" "$ENV_FILE" | cut -d '=' -f 2- | tr -d '"' | tr -d "'")

# Создаем файл .env для React (ему нужны оба формата названий)
cat <<EOF > webapp/.env
SUPABASE_URL=$DB_URL
SUPABASE_ANON_KEY=$DB_KEY
VITE_SUPABASE_URL=$DB_URL
VITE_SUPABASE_ANON_KEY=$DB_KEY
EOF

echo "✅ Секретные ключи прошиты в Мини-Апп!"
echo "🛠 Собираю визуальную часть в папку dist... (это займет 10-15 секунд)"

cd webapp
npm install --legacy-peer-deps > /dev/null 2>&1
npm run build > /dev/null 2>&1

echo "♻ Перезапускаю сервер бота..."
cd ..
pm2 restart esim-bot-1 > /dev/null 2>&1

echo "=========================================="
echo "🎉 ГОТОВО! Черный экран побежден навсегда!"
echo "Открой Телеграм и проверь Мини-Апп."
echo "=========================================="
