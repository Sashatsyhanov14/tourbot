#!/bin/bash
# --- SETUP SCRIPT FOR BOT 2 (TOUR) ---

echo "⚙️  Configuring Bot 2 (Tour)..."

# 1. Create .env file
cat <<EOF > bot/.env
BOT_TOKEN=7744149767:AAGtfpAcvrojNfJcgyxKV5up7D4_JhLZb8E
OPENAI_API_KEY=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
SUPABASE_URL=https://szvfoasvfxopnomipktj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmZvYXN2ZnhvcG5vbWlwa3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM1Mzc4NCwiZXhwIjoyMDg5OTI5Nzg0fQ.6196t1-d4YNs4dldelndW4BnwZAE7qsBDXLhtk8s7vw
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dmZvYXN2ZnhvcG5vbWlwa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTM3ODQsImV4cCI6MjA4OTkyOTc4NH0.dbx3UpDxJ0cix_rDuwqjftDOXaV8I87bKIny-fr7NWs
PORT=3002
WEBAPP_URL=https://tour.ticaretai.tr
EOF

echo "✅ .env created!"

# 2. Update ecosystem.config.js for PM2 name/port
cat <<EOF > ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bot2',
      script: 'npm',
      args: 'start',
      cwd: './bot',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
EOF

echo "✅ ecosystem.config.js updated!"

# 3. Install and set Webhook
cd bot && npm install
curl "https://api.telegram.org/bot7744149767:AAGtfpAcvrojNfJcgyxKV5up7D4_JhLZb8E/setWebhook?url=https://tour.ticaretai.tr/api/webhook"

echo "🎯 Setup complete for Bot 2! Run 'pm2 start ecosystem.config.js' to finish."
