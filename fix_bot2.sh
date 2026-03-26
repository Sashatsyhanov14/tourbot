#!/bin/bash

echo "🚀 Установка правильных ключей и исправление сбоев..."

cd /root/bots/bot2/bot

echo "📝 Создаю идеальный .env файл..."
cat << 'EOF' > .env
BOT_TOKEN=7744149767:AAGtfpAcvrojNfJcgyxKV5up7D4_JhLZb8E
OPENAI_API_KEY=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
SUPABASE_URL=https://szvfoasvfxopnomipktj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmZvYXN2ZnhvcG5vbWlwa3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1Mzc4NCwiZXhwIjoyMDg5OTI5Nzg0fQ.6196t1-d4YNs4dldelndW4BnwZAE7qsBDXLhtk8s7vw
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmZvYXN2ZnhvcG5vbWlwa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTM3ODQsImV4cCI6MjA4OTkyOTc4NH0.dbx3UpDxJ0cix_rDuwqjftDOXaV8I87bKIny-fr7NWs
WEBAPP_URL=https://tour.ticaretai.tr
WEBHOOK_URL=https://tour.ticaretai.tr
PORT=3002
EOF

echo "📦 Проверяю библиотеки..."
npm install

echo "♻️ Перезапускаю бота..."
pm2 restart bot2 --update-env

echo "✅ ГОТОВО! Бот перезапущен со свежим кодом и правильными ключами."
echo "⏳ Жду 3 секунды и показываю логи (если тут нет ошибок, значит бот заработал):"
sleep 3
pm2 logs bot2 --lines 15 --nostream
