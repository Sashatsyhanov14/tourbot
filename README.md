# Tour Bot - Telegram-бот для бронирования экскурсий

Telegram-бот с каталогом экскурсий и AI-гидом для автоматизации бронирования туров и экскурсий.

## 🗺️ Описание проекта

Автоматизация приема заявок на экскурсии через Telegram с AI-консультантом и системой управления бронированиями.

### Ключевые особенности:
- 🏛️ **Каталог экскурсий** - описание, фото, цены
- 🤖 **AI-гид** - рекомендации по турам
- 📅 **Форма бронирования** - даты, место встречи
- 👨‍💼 **Система заявок** - обработка менеджерами
- 🔗 **Реферальная система** - приглашение друзей с балансом
- 🏨 **Трансфер из отеля** - указание места забора
- 🗄️ **Supabase на VPS**

## Технологический стек

- **Node.js** + **Telegraf**
- **OpenAI API** - AI-консультант
- **Supabase** (PostgreSQL) на VPS
- **Express** - API сервер

## Структура базы данных

```sql
excursions (
  city, title, description,
  price_rub, duration, included,
  meeting_point, image_url, is_active
)

users (
  telegram_id, username, referrer_id,
  role (user/founder/manager)
)

requests (
  user_id, excursion_id, excursion_title,
  full_name, tour_date, hotel_name,
  price_rub, status (new/contacted/done/cancelled),
  assigned_manager
)

chat_history (
  user_id, role, content
)

faq (
  topic, content_ru
)
```

## Установка

```bash
git clone https://github.com/Sashatsyhanov14/tourbot.git
cd tourbot
npm install
```

### Конфигурация

**.env:**
```env
BOT_TOKEN=your_bot_token
MANAGER_ID=your_telegram_id
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_key
OPENAI_API_KEY=your_openai_key
```

### База данных

```bash
psql -f database_schema.sql
```

### Запуск

```bash
npm start
```

## Функционал

### Для туристов:
- 🗺️ Просмотр экскурсий по городам
- 💬 AI-гид (рекомендации)
- 📝 Бронирование тура
- 🏨 Указание отеля для трансфера
- 📅 Выбор даты

### Для менеджеров:
- 📊 Все заявки в одном месте
- ✅ Принятие бронирований
- 💬 Связь с туристами
- 🗺️ Управление экскурсиями

## Процесс бронирования

1. Турист выбирает экскурсию
2. Заполняет форму (ФИО, дата, отель)
3. Заявка попадает менеджеру
4. Менеджер связывается и подтверждает
5. Турист получает детали встречи

## Особенности

### Что включено в экскурсию:
- Трансфер (если указано)
- Услуги гида
- Входные билеты
- Обед/ужин (опционально)

### Города:
Легко расширяется под любые города через базу данных.

## Статус проекта

**Работает:**
- ✅ Каталог экскурсий
- ✅ AI-гид
- ✅ Система бронирований
- ✅ Админ-панель

**Статус:** 🚧 Развернут на VPS, готов к приему заявок.

## Контакты

- **GitHub**: [@Sashatsyhanov14](https://github.com/Sashatsyhanov14)
- **Email**: alexandertsyhanov@gmail.com
