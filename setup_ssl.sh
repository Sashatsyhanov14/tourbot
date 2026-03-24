#!/bin/bash

# Устанавливаем Nginx если его вдруг нет
apt update && apt install -y nginx

echo "Создаем конфигурационный файл Nginx для ticaretai.tr..."
cat << 'EOF' > /etc/nginx/sites-available/ticaretai
server {
    listen 80;
    server_name ticaretai.tr www.ticaretai.tr;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "Активируем конфигурацию..."
ln -sf /etc/nginx/sites-available/ticaretai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "Перезагружаем Nginx..."
systemctl restart nginx

echo "Устанавливаем Certbot..."
apt install -y certbot python3-certbot-nginx

echo "Получаем SSL-сертификат (без лишних вопросов)..."
certbot --nginx -d ticaretai.tr -d www.ticaretai.tr --non-interactive --agree-tos -m admin@ticaretai.tr --redirect

echo ""
echo "================================================="
echo "🎉 Готово! Твой Мини-Апп теперь работает по адресу:"
echo "👉 https://ticaretai.tr"
echo "================================================="
echo "Можешь копировать эту ссылку и вставлять в @BotFather!"
