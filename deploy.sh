#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment update..."

# 1. Update code
echo "📦 Pulling latest code changes..."
git pull

# 2. Install dependencies
echo "📥 Installing dependencies (Root, WebApp, Bot)..."
npm install
cd webapp && npm install --legacy-peer-deps && cd ..
cd bot && npm install && cd ..

# 3. Build WebApp
echo "🏗️ Building WebApp..."
npm run build

# 4. Restart services
echo "♻️ Restarting PM2 process..."
# This will restart the app defined in ecosystem.config.js
pm2 restart ecosystem.config.js --env production

echo "✅ Deployment successful! Your bot and webapp are up to date."
