#!/bin/bash

# Единый скрипт обновления и исправления всех ботов
# Автор: Antigravity AI

# Массив папок ботов
BOT_DIRS=("bot1" "bot2" "bot3" "bot4")

echo "🚀 Начинаю глобальное обновление всех ботов..."

for DIR in "${BOT_DIRS[@]}"; do
    PATH_DIR="/root/bots/$DIR"
    if [ -d "$PATH_DIR" ]; then
        echo "------------------------------------------"
        echo "📂 Обработка $DIR..."
        
        # 1. Исправляем .env (удаляем лишний пробел после =)
        ENV_FILE="$PATH_DIR/bot/.env"
        if [ -f "$ENV_FILE" ]; then
            echo "🔧 Исправляю пробелы в .env для $DIR..."
            sed -i 's/OPENAI_API_KEY= /OPENAI_API_KEY=/' "$ENV_FILE"
            sed -i 's/OPENROUTER_API_KEY= /OPENROUTER_API_KEY=/' "$ENV_FILE"
        else
            echo "⚠️ Файл .env не найден в $PATH_DIR/bot/"
        fi

        # 2. Подтягиваем свежий код из GitHub
        echo "⬇️ Обновляю код из репозитория..."
        cd "$PATH_DIR" && git pull

        # 3. Перезапускаем через PM2
        echo "♻️ Перезапуск $DIR в PM2..."
        pm2 restart "$DIR"
    else
        echo "❌ Папка $PATH_DIR не найдена. Пропускаю."
    fi
done

echo "------------------------------------------"
echo "✅ Все боты обновлены и перезапущены!"
echo "💡 Совет: проверьте логи командой 'pm2 logs'"
