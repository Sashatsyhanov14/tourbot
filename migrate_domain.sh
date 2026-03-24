#!/bin/bash

# Скрипт автоматической настройки Nginx и SSL (Certbot) для новых ботов
# Использование: ./migrate_domain.sh bot_name domain.com dist_path port
# Пример: ./migrate_domain.sh bot2 bot2.example.com /home/user/tourbot/webapp/dist 3002

if [ "$#" -ne 4 ]; then
    echo "❌ Ошибка! Нужно 4 аргумента."
    echo "Использование: $0 [имя_процесса_pm2] [домен] [путь_к_папке_dist] [порт_бота]"
    echo "Пример: $0 bot2 bot2.ticaret.ru /home/username/bot2/webapp/dist 3002"
    exit 1
fi

APP_NAME=$1
DOMAIN=$2
DIST_PATH=$3
BOT_PORT=$4
CONF_FILE="/etc/nginx/sites-available/$APP_NAME.conf"

echo "---------------------------------------------------"
echo "🛠  Настройка домена $DOMAIN для $APP_NAME..."
echo "---------------------------------------------------"

# 1. Создание конфига Nginx
echo "📝 Создание конфигурации Nginx..."

cat <<EOF > /tmp/bot_nginx.conf
server {
    listen 80;
    server_name $DOMAIN;

    # Статические файлы Mini App (React)
    root $DIST_PATH;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API Бот (Прокси на порт ноды)
    location /api {
        proxy_pass http://localhost:$BOT_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Логи
    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log /var/log/nginx/${APP_NAME}_error.log;
}
EOF

sudo mv /tmp/bot_nginx.conf $CONF_FILE

# 2. Активация конфига
echo "🔗 Активация конфигурации..."
sudo ln -sf $CONF_FILE /etc/nginx/sites-enabled/

# 3. Проверка и перезапуск Nginx
echo "⚙️ Перезапуск Nginx..."
if sudo nginx -t; then
    sudo systemctl restart nginx
    echo "✅ Nginx настроен!"
else
    echo "❌ Ошибка в конфиге Nginx! Отмена."
    exit 1
fi

# 4. Получение SSL сертификата через Certbot
echo "🔒 Получение SSL сертификата для $DOMAIN..."
if command -v certbot &> /dev/null; then
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN || echo "⚠️ Не удалось получить SSL автоматически. Проверьте DNS А-запись."
else
    echo "⚠️ Certbot не установлен. SSL не настроен."
fi

echo ""
echo "---------------------------------------------------"
echo "🎉 ГОТОВО! Бот доступен по адресу: https://$DOMAIN"
echo "Не забудьте обновить WEBAPP_URL в .env и @BotFather!"
echo "---------------------------------------------------"
