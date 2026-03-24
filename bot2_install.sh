#!/bin/bash

# Скрипт автоматической установки бота #2 (Tour Booking Bot) на VPS
# Инструкция:
# 1. Залейте файлы на сервер
# 2. Выполните: chmod +x bot2_install.sh
# 3. Запустите: ./bot2_install.sh

echo "---------------------------------------------------"
echo "🚀 Установка проекта BOT #2 (Tour Booking)..."
echo "---------------------------------------------------"

# 1. Проверка и установка PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2 не найден. Устанавливаю глобально..."
    npm install -g pm2
else
    echo "✅ PM2 уже установлен."
fi

# 2. Установка зависимостей бота
echo "📦 Установка библиотек (npm install)..."
cd bot
npm install
cd ..

# 3. Настройка .env (если его нет)
if [ ! -f bot/.env ]; then
    echo ""
    echo "📝 ---- НАСТРОЙКА ПЕРЕМЕННЫХ ДЛЯ BOT #2 ----"
    echo "Введите данные (будут сохранены в bot/.env):"
    
    read -p "Telegram BOT_TOKEN: " bot_token
    read -p "OPENAI_API_KEY: " openai_key
    read -p "SUPABASE_URL: " sb_url
    read -p "SUPABASE_SERVICE_ROLE_KEY: " sb_key
    read -p "WEBAPP_URL: " webapp_url

    cat <<EOF > bot/.env
BOT_TOKEN=$bot_token
OPENAI_API_KEY=$openai_key
SUPABASE_URL=$sb_url
SUPABASE_SERVICE_ROLE_KEY=$sb_key
WEBAPP_URL=$webapp_url
EOF
    echo "✅ Файл .env для BOT #2 создан!"
else
    echo "ℹ️  Файл .env для BOT #2 уже существует."
fi

# 4. Запуск через PM2
echo ""
echo "🎬 Запуск BOT #2 в PM2..."
pm2 delete bot2 2>/dev/null
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "---------------------------------------------------"
echo "✅ BOT #2 УСПЕШНО ЗАПУЩЕН!"
echo "Имя процесса в списке: bot2"
echo "Используйте 'pm2 logs bot2' для логов."
echo "---------------------------------------------------"
