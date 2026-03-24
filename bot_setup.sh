#!/bin/bash

# Скрипт ФИНАЛЬНОЙ настройки бота (Bot2)
# Использование: ./bot_setup.sh

echo "---------------------------------------------------"
echo "🤖 Настройка основного бота (Bot2)..."
echo "---------------------------------------------------"

# 1. Запрос только необходимых данных
read -p "Вставьте Токен (от @BotFather): " BOT_TOKEN
read -p "Вставьте Ключ OpenRouter (sk-or-v1-...): " OPENROUTER_KEY

# 2. Идем СТРОГО в папку бота
cd /root/bot2/bot

# 3. Подтягиваем остальные данные из старого .env (если он есть)
if [ -f .env ]; then
    SUPABASE_URL=$(grep '^SUPABASE_URL=' .env | cut -d '=' -f2)
    SUPABASE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d '=' -f2)
    echo "✅ Данные Supabase подтянуты."
else
    echo "⚠️ Старый .env не найден. Введите данные вручную:"
    read -p "SUPABASE_URL: " SUPABASE_URL
    read -p "SUPABASE_KEY: " SUPABASE_KEY
fi

# 4. Создание ИДЕАЛЬНОГО .env СТРОГО В ПАПКЕ /root/bot2/bot/
echo "📝 Перезапись .env..."
cat <<EOF > .env
BOT_TOKEN=$BOT_TOKEN
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_KEY
OPENROUTER_API_KEY=$OPENROUTER_KEY
WEBAPP_URL=https://tour.ticaretai.tr
PORT=3002
EOF

# 5. Перезапуск процесса
echo "⚙️ Перезапуск бота..."
pm2 restart bot2
pm2 save

echo "---------------------------------------------------"
echo "✅ ГОТОВО! Бот настроен и запущен."
echo "Пробуйте отправить ему /start в Telegram."
echo "---------------------------------------------------"
