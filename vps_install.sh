#!/bin/bash

# Скрипт автоматической установки Tour Booking Bot на VPS
# Инструкция:
# 1. Залейте файлы на сервер
# 2. Выполните: chmod +x vps_install.sh
# 3. Запустите: ./vps_install.sh

echo "---------------------------------------------------"
echo "🚀 Начинаем установку Tour Booking Bot (bot2)..."
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
    echo "📝 ---- НАСТРОЙКА ПЕРЕМЕННЫХ (.env) ----"
    echo "Пожалуйста, введите данные (они будут сохранены в bot/.env):"
    
    read -p "Telegram BOT_TOKEN: " bot_token
    read -p "OPENAI_API_KEY (OpenRouter): " openai_key
    read -p "SUPABASE_URL: " sb_url
    read -p "SUPABASE_SERVICE_ROLE_KEY: " sb_key
    read -p "WEBAPP_URL (ссылка на ваш Vercel/сайт): " webapp_url

    cat <<EOF > bot/.env
BOT_TOKEN=$bot_token
OPENAI_API_KEY=$openai_key
SUPABASE_URL=$sb_url
SUPABASE_SERVICE_ROLE_KEY=$sb_key
WEBAPP_URL=$webapp_url
EOF
    echo "✅ Файл .env успешно создан!"
else
    echo "ℹ️  Файл .env уже существует. Пропускаю ввод данных."
fi

# 4. Запуск через PM2
echo ""
echo "🎬 Запуск бота через PM2..."
# Удаляем старый процесс если он был под этим именем
pm2 delete bot2 2>/dev/null
pm2 start ecosystem.config.js

# 5. Сохранение списка процессов (чтобы они вставали после ребута VPS)
pm2 save

echo ""
echo "---------------------------------------------------"
echo "✅ ВСЕ ГОТОВО! Бот работает как процесс 'bot2'."
echo "Используйте 'pm2 list' для проверки статуса."
echo "Используйте 'pm2 logs bot2' для просмотра логов."
echo "---------------------------------------------------"
