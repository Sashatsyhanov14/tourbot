#!/bin/bash

# Скрипт быстрой настройки основного бота
# Использование: ./bot_setup.sh

echo "---------------------------------------------------"
echo "🤖 Настройка основного бота (Bot2)..."
echo "---------------------------------------------------"

# 1. Запрос только необходимых данных
read -p "Вставьте Токен (от @BotFather): " BOT_TOKEN
read -p "Вставьте Ключ OpenRouter (sk-or-v1-...): " OPENROUTER_KEY

# 2. Подтягиваем остальные данные из текущего файла (если они есть)
cd /root/bot2/bot
if [ -f .env ]; then
    SUPABASE_URL=$(grep '^SUPABASE_URL=' .env | cut -d '=' -f2)
    SUPABASE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d '=' -f2)
else
    read -p "SUPABASE_URL (если файла нет): " SUPABASE_URL
    read -p "SUPABASE_KEY (если файла нет): " SUPABASE_KEY
fi

# 3. Создание идеального .env
echo "📝 Перезапись .env..."
cat <<EOF > .env
BOT_TOKEN=$BOT_TOKEN
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_KEY
OPENROUTER_API_KEY=$OPENROUTER_KEY
WEBAPP_URL=https://tour.ticaretai.tr
PORT=3002
EOF

# 4. Перезапуск процесса
echo "⚙️ Перезапуск бота..."
pm2 restart bot2
pm2 save

echo "---------------------------------------------------"
echo "✅ ГОТОВО! Бот настроен и запущен."
echo "Напишите боту в Telegram, чтобы проверить связь."
echo "---------------------------------------------------"
