#!/bin/bash

# Скрипт быстрого исправления конфигурации WebApp
# 1. Создает .env с ключами Supabase
# 2. Собирает проект
# 3. Переносит в /var/www/ и настраивает права

echo "---------------------------------------------------"
echo "🛠  Настройка WebApp (Vite + Supabase)..."
echo "---------------------------------------------------"

# Запрос данных (извлекаем из .env бота без ошибок)
cd /root/bot2/bot
if [ -f .env ]; then
    # Надёжный способ считать переменную из .env без 'export'
    SUPABASE_URL=$(grep '^SUPABASE_URL=' .env | cut -d '=' -f2)
    SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d '=' -f2)
    echo "✅ Данные из bot/.env успешно извлечены."
else
    echo "❌ bot/.env не найден. Введите данные вручную:"
    read -p "SUPABASE_URL: " SUPABASE_URL
    read -p "SUPABASE_SERVICE_ROLE_KEY (или ANON): " SUPABASE_SERVICE_ROLE_KEY
fi

# 1. Создание .env для WebApp
echo "📝 Создание webapp/.env..."
cd /root/bot2/webapp
cat <<EOF > .env
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF

# 2. Сборка
echo "📦 Сборка WebApp (это займет минуту)..."
npm install --legacy-peer-deps
npm run build

# 3. Перенос в /var/www/ (для Nginx)
echo "📂 Перенос файлов в /var/www/tourbot..."
sudo mkdir -p /var/www/tourbot
sudo cp -r dist/* /var/www/tourbot/
sudo chown -R www-data:www-data /var/www/tourbot

# 4. Перезапуск Nginx
echo "⚙️ Перезапуск Nginx..."
sudo systemctl restart nginx

echo "---------------------------------------------------"
echo "🎉 ГОТОВО! Проверяйте https://tour.ticaretai.tr"
echo "---------------------------------------------------"
