#!/bin/bash

# Скрипт настройки ключей на сервере
# После запуска этот файл НУЖНО удалить!

BOT_DIR="/root/bot2/bot"
mkdir -p "$BOT_DIR"

cat <<'EOF' > "$BOT_DIR/.env"
BOT_TOKEN=7744149767:AAGtfpAcvrojNfJcgyxKV5up7D4_JhLZb8E
OPENAI_API_KEY=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
SUPABASE_URL=https://szvfoasvfxopnomipktj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmZvYXN2ZnhvcG5vbWlwa3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1Mzc4NCwiZXhwIjoyMDg5OTI5Nzg0fQ.6196t1-d4YNs4dldelndW4BnwZAE7qsBDXLhtk8s7vw
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmZvYXN2ZnhvcG5vbWlwa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTM3ODQsImV4cCI6MjA4OTkyOTc4NH0.dbx3UpDxJ0cix_rDuwqjftDOXaV8I87bKIny-fr7NWs
WEBAPP_URL=https://tour.ticaretai.tr
PORT=3002
EOF

pm2 restart bot2
echo "✅ Ключи установлены, бот перезапущен!"
