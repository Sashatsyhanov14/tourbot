const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { supabase, getUser, createUser, getExcursions, saveMessage, getHistory, createRequest, getFaq, clearHistory } = require('./src/supabase');
const { getChatResponse, getLocalizedText, getManagerReport } = require('./src/openai');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const MANAGER_ID = parseInt(process.env.MANAGER_ID);

// Кеш языков и состояний пользователей
const userLangCache = {};
const userQrBtnCache = {}; // cached translated QR button text per user
const lastShownExcursion = {}; // telegramId → excursionId of last shown excursion
const userStates = new Map(); // { telegramId: { step: 'name'|'date'|'hotel', excursionId, data: {} } }

// QR button keywords for detection in any language
const QR_KEYWORDS = ['qr', 'промокод', 'promo', 'refer', 'реферал', 'benim qr', 'qrcode'];

bot.use(session());

// --- TOP-LEVEL DEBUG LOGGING ---
bot.use(async (ctx, next) => {
    if (ctx.message) {
        const type = ctx.message.web_app_data ? 'WEB_APP_DATA' : (ctx.message.text ? 'TEXT' : 'OTHER');
        console.log(`[DEBUG_TOP] Message from ${ctx.from?.id}: ${type}`);
        if (ctx.message.web_app_data) {
            console.log(`[DEBUG_TOP] Data: ${ctx.message.web_app_data.data}`);
        }
    }
    return next();
});

// --- MANAGER ACTIONS ---
bot.action(/^accept_req_(.+)$/, async (ctx) => {
    const requestId = ctx.match[1];
    const managerId = ctx.from.id;

    const { data: manager } = await getUser(managerId);
    if (!manager || (manager.role !== 'founder' && manager.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав.', { show_alert: true });
    }

    const { data: request } = await supabase.from('requests').select('*').eq('id', requestId).single();
    if (!request) return ctx.answerCbQuery('❌ Заявка не найдена.', { show_alert: true });
    if (request.status !== 'new') return ctx.answerCbQuery('⚠️ Заявка уже обработана.', { show_alert: true });

    await supabase.from('requests').update({ status: 'contacted', assigned_manager: managerId }).eq('id', requestId);

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + `\n\n✅ ПРИНЯТО: @${ctx.from.username || managerId}`,
            Markup.inlineKeyboard([[Markup.button.callback('💰 Начислить бонусы', `bonus_req_${requestId}`)]])
        );

        const lang = userLangCache[request.user_id] || 'ru';
        const msgRu = `✅ Ваша заявка на экскурсию «${request.excursion_title}» принята в работу! Оператор свяжется с вами в ближайшее время.`;
        const msg = await getLocalizedText(lang, msgRu);
        await bot.telegram.sendMessage(request.user_id, msg);

    } catch (e) { console.error('Accept error:', e.message); }

    await ctx.answerCbQuery('✅ Вы приняли заявку.');
});

bot.action(/^cancel_req_(.+)$/, async (ctx) => {
    const requestId = ctx.match[1];
    const managerId = ctx.from.id;

    const { data: manager } = await getUser(managerId);
    if (!manager || (manager.role !== 'founder' && manager.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав.', { show_alert: true });
    }

    await supabase.from('requests').update({ status: 'cancelled', assigned_manager: managerId }).eq('id', requestId);

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + `\n\n❌ ОТКЛОНЕНО: @${ctx.from.username || managerId}`,
            Markup.inlineKeyboard([])
        );
    } catch (e) { }

    await ctx.answerCbQuery('Заявка отклонена.');
});

// Начисль бонусы рефереру за заявку
bot.action(/^bonus_req_(.+)$/, async (ctx) => {
    const requestId = ctx.match[1];
    const managerId = ctx.from.id;

    const { data: manager } = await getUser(managerId);
    if (!manager || (manager.role !== 'founder' && manager.role !== 'manager')) {
        return ctx.answerCbQuery('❌ Нет прав.', { show_alert: true });
    }

    const { data: request } = await supabase.from('requests').select('*').eq('id', requestId).single();
    if (!request) return ctx.answerCbQuery('❌ Заявка не найдена.', { show_alert: true });

    try {
        // Начисление 1% рефереру покупателя
        const { data: buyer } = await supabase.from('users').select('referrer_id').eq('telegram_id', request.user_id).single();
        if (buyer?.referrer_id && request.price_rub) {
            const reward = Math.round(request.price_rub * 0.01);
            const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', buyer.referrer_id).single();
            const newBalance = Math.round(((refUser?.balance || 0) + reward));
            await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', buyer.referrer_id);

            try {
                const refLang = userLangCache[buyer.referrer_id] || 'ru';
                const refRu = `💰 Вам начислено $${reward} (1% от заявки на экскурсию «${request.excursion_title}»)! Ваш баланс: $${newBalance}`;
                const refMsg = await getLocalizedText(refLang, refRu);
                await bot.telegram.sendMessage(buyer.referrer_id, refMsg);
            } catch (e) { }

            await ctx.editMessageText(
                ctx.callbackQuery.message.text + `\n\n💰 БОНУС $${reward} начислен рефереру (ID: ${buyer.referrer_id})`,
                Markup.inlineKeyboard([])
            );
            await ctx.answerCbQuery(`✅ Бонус $${reward} успешно начислен!`, { show_alert: true });
        } else {
            await ctx.answerCbQuery('⚠️ У этого клиента нет реферера или не указана стоимость экскурсии.', { show_alert: true });
        }
    } catch (e) {
        console.error('Bonus action error:', e.message);
        await ctx.answerCbQuery('❌ Ошибка при начислении.', { show_alert: true });
    }
});

// --- CLIENT FLOW ---
bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    const startPayload = ctx.payload;

    try {
        console.log(`[START] Triggered for ${username} (${telegramId}), payload: ${startPayload}`);

        // --- QR DEEP LINK from WebApp button ---
        if (startPayload && startPayload.startsWith('getqr_')) {
            const lang = userLangCache[telegramId] || ctx.from.language_code || 'ru';
            const botUsername = ctx.botInfo?.username || 'Emedeotour_bot';
            const refLink = `https://t.me/${botUsername}?start=${telegramId}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(refLink)}&margin=15&bgcolor=ffffff`;
            const captionRu = `🔗 *Link:* \`${refLink}\`\n🎫 *Promo:* \`${telegramId}\`\n\n✨ Поделитесь QR или промокодом — получайте 1$ за каждого друга!`;
            const caption = await getLocalizedText(lang, captionRu);
            try {
                await ctx.replyWithPhoto(qrUrl, { caption, parse_mode: 'Markdown' });
            } catch {
                await ctx.reply(caption, { parse_mode: 'Markdown' });
            }
            return;
        }

        userStates.delete(telegramId);
        await clearHistory(telegramId);

        let { data: user } = await getUser(telegramId);
        if (!user) {
            const referrerId = startPayload && !isNaN(startPayload) ? parseInt(startPayload) : null;
            const { data: newUser } = await createUser({
                telegram_id: telegramId,
                username: username,
                role: 'user',
                referrer_id: (referrerId && referrerId !== telegramId) ? referrerId : null,
                balance: 0
            });
            user = newUser;
        }

        const lang = ctx.from.language_code || 'ru';
        userLangCache[telegramId] = lang;

        const welcomeRuPart1 = `Привет, ${username}! 🌍\n\nЯ твой персональный гид — помогу выбрать лучшую экскурсию, расскажу о маршрутах и отвечу на любые вопросы.\n\nОткрой каталог ниже или просто напиши: какой город тебя интересует? 🗺️`;

        const welcomeText1 = await getLocalizedText(lang, welcomeRuPart1);
        const webappBtnRu = '🎒 Открыть Каталог';
        const qrBtnRu = '📲 Мой QR / Промокод';
        const webappBtn = await getLocalizedText(lang, webappBtnRu);
        const qrBtn = await getLocalizedText(lang, qrBtnRu);
        // Cache translated QR button text for detection later
        userQrBtnCache[telegramId] = qrBtn;

        // Очистка старой клавиатуры
        try {
            const k = await ctx.reply('…', Markup.removeKeyboard());
            await bot.telegram.deleteMessage(ctx.chat.id, k.message_id);
        } catch (e) { }

        await ctx.reply(welcomeText1,
            Markup.keyboard([
                [Markup.button.webApp(webappBtn, `${process.env.WEBAPP_URL || ''}?uid=${telegramId}`)],
                [qrBtn]
            ]).resize()
        );
        console.log(`[START] Welcome Part 1 sent to ${username}`);

        // Задержанное 2-е сообщение
        setTimeout(async () => {
            try {
                const welcomeRuPart2 = `📍 Мы работаем в нескольких городах России: Москва, Санкт-Петербург, Сочи, Казань и другие.\n\nПросто напиши название города — и я покажу, что у нас есть! Или открой каталог и выбери экскурсию прямо там 👆`;
                const welcomeText2 = await getLocalizedText(lang, welcomeRuPart2);
                await bot.telegram.sendMessage(telegramId, welcomeText2);
                console.log(`[START] Welcome Part 2 sent to ${username}`);
            } catch (err) {
                console.error('[START Part 2] Error:', err.message);
            }
        }, 2500);

    } catch (err) {
        console.error('[START] Fatal Error:', err.message);
        try { await ctx.reply('Привет! Я гид по экскурсиям. Напиши город или открой каталог!'); } catch (e) { }
    }
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const lang = userLangCache[telegramId] || 'ru';
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${telegramId}`;

    const textRu = `🎁 Твоя реферальная ссылка:\n\n${refLink}\n\nТвой промокод: \`${telegramId}\`\n\nПриглашай друзей и получай бонусы!`;
    const text = await getLocalizedText(lang, textRu);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    try {
        await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
    } catch (err) {
        await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
});

// --- WEB APP DATA (sendData from mini-app buttons) ---
bot.on('web_app_data', async (ctx) => {
    const dataStr = ctx.webAppData?.data.trim();
    if (!dataStr) return;
    console.log(`[WEB_APP_DATA_EVENT] Data: ${dataStr}`);
    // I will call a shared handler here
    await handleWebAppData(ctx, dataStr);
});

bot.on('message', async (ctx, next) => {
    const dataStr = ctx.message?.web_app_data?.data;
    if (!dataStr) return next();
    console.log(`[MESSAGE_EVENT_WEBAPP] Data: ${dataStr}`);
    await handleWebAppData(ctx, dataStr);
});

async function handleWebAppData(ctx, dataStr) {
    const telegramId = ctx.from.id;
    const lang = userLangCache[telegramId] || 'ru';

    try {
        const data = JSON.parse(dataStr);
        console.log(`[HANDLE_DATA] Type: ${data.type}`);
        
        // --- Quick Booking from Catalog ---
        if (data.type === 'quick_book') {
            const { excursionId, excursionTitle, fullName, phone, tourDate } = data;
            
            // Create request in DB
            await supabase.from('requests').insert([{
                id: crypto.randomUUID(),
                user_id: telegramId,
                excursion_id: excursionId,
                excursion_title: excursionTitle,
                full_name: fullName,
                tour_date: tourDate,
                phone: phone,
                price_rub: data.priceRub || 0,
                status: 'from_webapp',
                created_at: new Date().toISOString()
            }]);

            // Notify Managers
            const reportRu = `🆕 *НОВАЯ ЗАЯВКА ИЗ КАТАЛОГА!*\n\n📍 *Тур:* ${excursionTitle}\n👤 *Клиент:* ${fullName}\n📱 *Телефон:* \`${phone}\`\n🗓️ *Дата:* ${tourDate}\n\n🚀 _Заявка оформлена через Mini App!_`;
            const report = await getLocalizedText('ru', reportRu);

            const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'manager']);
            if (managers) {
                for (const m of managers) {
                    try { await bot.telegram.sendMessage(m.telegram_id, report, { parse_mode: 'Markdown' }); } catch (e) {}
                }
            }

            const successRu = '✅ *Заявка отправлена!*\n\nНаш менеджер свяжется с вами в ближайшее время. Спасибо!';
            const successMsg = await getLocalizedText(lang, successRu);
            try { return await ctx.reply(successMsg, { parse_mode: 'Markdown' }); } catch (e) { return ctx.reply(successMsg); }
        }

        // --- AI Auto Translate Excursion ---
        if (data.type === 'auto_translate_excursion') {
            const { excursionId, data: exData } = data;
            const languages = ['en', 'tr'];
            const fields = ['title', 'city', 'description', 'duration', 'included', 'meeting_point'];
            const updates = {};

            for (const targetLang of languages) {
                for (const field of fields) {
                    const sourceText = exData[field];
                    if (sourceText) {
                        console.log(`[AI_TRANSLATE] Translating ${field} to ${targetLang}...`);
                        const translated = await getLocalizedText(targetLang, sourceText);
                        if (translated && translated !== sourceText) {
                            updates[`${field}_${targetLang}`] = translated;
                        }
                    }
                }
            }

            if (Object.keys(updates).length > 0 && excursionId !== 'new') {
                const { error } = await supabase.from('excursions').update(updates).eq('id', excursionId);
                if (error) console.error('[AI_TRANSLATE] Update error:', error.message);
                else console.log(`[AI_TRANSLATE] Updated excursion ${excursionId} success!`);
            }

            const confirmMsg = `✅ *AI Перевод завершен!*\n\nЯ перевел данные на английский и турецкий. `;
            return ctx.reply(confirmMsg, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        // Fallback for QR keywords if not JSON
        if (QR_KEYWORDS.some(kw => dataStr.toLowerCase().includes(kw)) || dataStr.includes('QR')) {
            const botUsername = ctx.botInfo?.username || '';
            const refLink = `https://t.me/${botUsername}?start=${telegramId}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(refLink)}&margin=15&bgcolor=ffffff`;
            const captionRu = `🔗 *Link:* \`${refLink}\`\n🎫 *Promo:* \`${telegramId}\`\n\n✨ Поделитесь этим QR — получайте 1$ бонус за каждого друга!`;
            const caption = await getLocalizedText(lang, captionRu);
            try {
                await ctx.replyWithPhoto(qrUrl, { caption, parse_mode: 'Markdown' });
            } catch {
                await ctx.reply(caption, { parse_mode: 'Markdown' });
            }
        }
    }
}

// Keep a minimal message event to not block other logic
bot.on('message', async (ctx, next) => {
    if (ctx.message?.web_app_data) return; // already handled
    console.log(`[INCOMING] From ${ctx.from.id}: ${ctx.message.text || 'non-text'}`);
    return next();
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    const userText = ctx.message.text.trim();
    const state = userStates.get(telegramId);

    // --- QR BUTTON HANDLER ---
    const isQrRequest =
        (userQrBtnCache[telegramId] && userText === userQrBtnCache[telegramId]) ||
        QR_KEYWORDS.some(kw => userText.toLowerCase().includes(kw));

    if (isQrRequest) {
        const lang = userLangCache[telegramId] || 'ru';
        const botUsername = ctx.botInfo?.username || '';
        const refLink = `https://t.me/${botUsername}?start=${telegramId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(refLink)}&margin=15&bgcolor=ffffff`;

        const captionRu = `🔗 *Link:* \`${refLink}\`\n🎫 *Promo:* \`${telegramId}\`\n\n✨ Поделитесь этим QR или промокодом — и получайте бонусы за каждого друга!`;
        const caption = await getLocalizedText(lang, captionRu);

        try {
            await ctx.replyWithPhoto(qrUrl, { caption, parse_mode: 'Markdown' });
        } catch (e) {
            await ctx.reply(caption, { parse_mode: 'Markdown', disable_web_page_preview: true });
        }
        return;
    }
    // --- PHOTO REQUEST HANDLER ---
    const PHOTO_KEYWORDS = ['фото', 'photo', 'фотографи', 'покажи', 'картинк', 'picture', 'image', 'resim', 'fotoğraf', 'görsel'];
    const isPhotoRequest = PHOTO_KEYWORDS.some(kw => userText.toLowerCase().includes(kw)) && !state;

    if (isPhotoRequest) {
        const lang = userLangCache[telegramId] || 'ru';
        try { await ctx.sendChatAction('upload_photo'); } catch (e) {}

        // Find last mentioned excursion from cache or recent history
        const { data: excursions } = await getExcursions();
        let foundEx = null;

        // Check cache first (last excursion shown to this user)
        const cachedId = lastShownExcursion[telegramId];
        if (cachedId && excursions) {
            foundEx = excursions.find(e => e.id === cachedId);
        }

        // Fallback: scan last bot messages for excursion title
        if (!foundEx && excursions) {
            const { data: history } = await getHistory(telegramId);
            const botMessages = (history || []).filter(m => m.role === 'assistant').slice(-5);
            for (const ex of excursions) {
                if (botMessages.some(m => m.content?.toLowerCase().includes(ex.title.toLowerCase()))) {
                    foundEx = ex;
                    break;
                }
            }
        }

        if (foundEx) {
            const photos = (foundEx.image_urls && Array.isArray(foundEx.image_urls) && foundEx.image_urls.length > 0)
                ? foundEx.image_urls
                : (foundEx.image_url ? [foundEx.image_url] : []);

            if (photos.length > 0) {
                try {
                    if (photos.length === 1) {
                        await bot.telegram.sendPhoto(telegramId, photos[0]);
                    } else {
                        await bot.telegram.sendMediaGroup(telegramId, photos.slice(0, 10).map(url => ({ type: 'photo', media: url })));
                    }
                    const replyRu = `📸 Фотографии экскурсии «${foundEx.title}»!`;
                    const reply = await getLocalizedText(lang, replyRu);
                    await ctx.reply(reply);
                } catch (e) {
                    console.warn('[PhotoRequest] send error:', e.message);
                    const errRu = `К сожалению, не удалось загрузить фото. 😔 Попробуй позже.`;
                    await ctx.reply(await getLocalizedText(lang, errRu));
                }
            } else {
                const noPhotoRu = `😔 У экскурсии «${foundEx.title}» пока нет фотографий. Хочешь узнать подробности или забронировать?`;
                await ctx.reply(await getLocalizedText(lang, noPhotoRu));
            }
        } else {
            const notFoundRu = `Напиши, какая экскурсия тебя интересует — и я покажу фото! 📸`;
            await ctx.reply(await getLocalizedText(lang, notFoundRu));
        }
        return;
    }

    // --- STATE MACHINE (Сбор данных заказа) ---
    if (state) {
        const lang = userLangCache[telegramId] || 'ru';

        if (state.step === 'name') {
            state.data.fullName = userText;
            state.step = 'date';
            const msg = await getLocalizedText(lang, '🗓️ Отлично! Теперь напишите желаемую дату (например: завтра, 25 мая, или конкретный период):');
            return ctx.reply(msg);
        }

        if (state.step === 'date') {
            state.data.tourDate = userText;
            state.step = 'hotel';
            const msg = await getLocalizedText(lang, '🏨 Понял. Напишите ваш город и название отеля (или адрес, откуда вас забрать):');
            return ctx.reply(msg);
        }

        if (state.step === 'hotel') {
            state.data.hotelName = userText;
            state.step = 'phone';
            const msg = await getLocalizedText(lang, '📞 Почти готово! Укажите номер WhatsApp для связи с оператором:');
            return ctx.reply(msg);
        }

        if (state.step === 'phone') {
            state.data.phone = userText;
            const excursionId = state.excursionId;

            const { data: excursions } = await getExcursions();
            const selectedEx = excursions ? excursions.find(e => e.id === excursionId) : null;

            const { data: order } = await createRequest(
                telegramId,
                excursionId,
                selectedEx ? selectedEx.title : 'Экскурсия',
                state.data.fullName,
                state.data.tourDate,
                state.data.hotelName,
                selectedEx ? selectedEx.price_rub : 0,
                state.data.phone
            );

            const { data: user } = await getUser(telegramId);
            const { data: history } = await getHistory(telegramId, 10);
            const aiReport = await getManagerReport(user, history, selectedEx, state.data);

            userStates.delete(telegramId);

            const thanksRu = `✅ Спасибо! Заявка отправлена. Наш оператор свяжется с вами по номеру ${userText} в ближайшее время. 🙌`;
            const thanksMsg = await getLocalizedText(lang, thanksRu);
            await ctx.reply(thanksMsg);

            // --- РЕФЕРАЛЬНОЕ НАЧИСЛЕНИЕ: 1% от стоимости ---
            try {
                const { data: buyer } = await supabase.from('users').select('referrer_id').eq('telegram_id', telegramId).single();
                if (buyer?.referrer_id && selectedEx?.price_rub) {
                    const reward = Math.round(selectedEx.price_rub * 0.01);
                    const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', buyer.referrer_id).single();
                    const newBalance = Math.round(((refUser?.balance || 0) + reward));
                    await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', buyer.referrer_id);
                    try {
                        const refLang = userLangCache[buyer.referrer_id] || 'ru';
                        const refRu = `💰 Вам начислено $${reward} (1% от заявки на экскурсию «${selectedEx.title}»)! Ваш баланс: $${newBalance}`;
                        const refMsg = await getLocalizedText(refLang, refRu);
                        await bot.telegram.sendMessage(buyer.referrer_id, refMsg);
                    } catch (e) { }
                }
            } catch (e) {
                console.error('Referral payout error:', e.message);
            }

            // Уведомление менеджерам
            const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'manager']);
            if (managers) {
                for (const m of managers) {
                    try {
                        await bot.telegram.sendMessage(m.telegram_id, aiReport, {
                            parse_mode: 'Markdown',
                            ...Markup.inlineKeyboard([
                                [
                                    Markup.button.callback('✅ Принять', `accept_req_${order.id}`),
                                    Markup.button.callback('❌ Отклонить', `cancel_req_${order.id}`)
                                ],
                                [
                                    Markup.button.callback('💰 Начислить бонусы', `bonus_req_${order.id}`)
                                ]
                            ])
                        });
                    } catch (e) {
                        try {
                            await bot.telegram.sendMessage(m.telegram_id, aiReport.replace(/[\*_`\[\]()]/g, ''), {
                                ...Markup.inlineKeyboard([
                                    [
                                        Markup.button.callback('✅ Принять', `accept_req_${order.id}`),
                                        Markup.button.callback('❌ Отклонить', `cancel_req_${order.id}`)
                                    ],
                                    [
                                        Markup.button.callback('💰 Начислить бонусы', `bonus_req_${order.id}`)
                                    ]
                                ])
                            });
                        } catch (e2) { console.error('Manager notify error:', e2.message); }
                    }
                }
            }
            return;
        }
    }

    // --- AI ЧАТ ---
    const username = ctx.from.username || ctx.from.first_name;

    try {
        let { data: user } = await getUser(telegramId);
        if (!user) {
            const { data: newUser } = await createUser({
                telegram_id: telegramId,
                username: ctx.from.username || ctx.from.first_name,
                role: 'user',
                balance: 0
            });
            user = newUser;
        }

        const systemLang = ctx.from.language_code || 'ru';
        if (!userLangCache[telegramId]) {
            userLangCache[telegramId] = systemLang;
        }
        const uiLang = userLangCache[telegramId];

        // --- PROMO CODE LOGIC ---
        if (!user.referrer_id && /^\d{6,15}$/.test(userText)) {
            const promoId = parseInt(userText);
            if (promoId !== telegramId) {
                const { data: promoUser } = await getUser(promoId);
                if (promoUser) {
                    await supabase.from('users').update({ referrer_id: promoId }).eq('telegram_id', telegramId);
                    user.referrer_id = promoId;

                    const successRu = '✅ Промокод успешно применён! Спасибо.\n\nА теперь расскажи, куда планируешь экскурсию? 🌍';
                    const successText = await getLocalizedText(uiLang, successRu);
                    return ctx.reply(successText);
                }
            }
            const failRu = '❌ Неверный или недействительный промокод.';
            const failText = await getLocalizedText(uiLang, failRu);
            return ctx.reply(failText);
        }

        await saveMessage(telegramId, 'user', userText);

        const { data: history } = await getHistory(telegramId);
        const { data: excursions } = await getExcursions();
        const { data: faqRows } = await getFaq();

        const faqText = faqRows ? faqRows.map(f => `- ${f.topic}: ${f.content_ru}`).join('\n') : '';

        try { await ctx.sendChatAction('typing'); } catch (e) { }

        const aiResponse = await getChatResponse(excursions, faqText, history, userText);

        const langMatch = aiResponse.match(/\[LANG:\s*(ru|tr|en)\]/i);
        if (langMatch) userLangCache[telegramId] = langMatch[1].toLowerCase();

        const bookMatch = aiResponse.match(/\[BOOK_REQUEST:\s*([a-zA-Z0-9_-]+)\]/i);
        let finalResponse = aiResponse.replace(/\[BOOK_REQUEST:.*?\]/gi, '').replace(/\[LANG:.*?\]/gi, '').trim();


    // Helper: send all photos of an excursion as album
    const sendExcursionPhotos = async (ex) => {
        const photos = (ex.image_urls && Array.isArray(ex.image_urls))
            ? ex.image_urls.filter(url => url && url.startsWith('http'))
            : (ex.image_url ? [ex.image_url] : []);

        if (photos.length === 0) return;

        try {
            console.log(`[PHOTOS] Sending ${photos.length} photos for: ${ex.title}`);
            if (photos.length === 1) {
                await bot.telegram.sendPhoto(telegramId, photos[0]);
            } else {
                const media = photos.slice(0, 10).map(url => ({ type: 'photo', media: url }));
                await bot.telegram.sendMediaGroup(telegramId, media);
            }
        } catch (e) {
            console.warn('[MediaGroup] Error sending photos:', e.message);
        }
    };

    if (bookMatch) {
        const excursionId = bookMatch[1];
        const selectedEx = excursions ? excursions.find(e => e.id === excursionId) : null;

        if (selectedEx) {
            userStates.set(telegramId, { step: 'name', excursionId, data: {} });

            const currentLang = userLangCache[telegramId] || 'ru';
            const namePromptRu = `Прекрасный выбор! 😍 Чтобы оформить заявку на экскурсию «${selectedEx.title}», мне нужно уточнить пару деталей.\n\n👤 Как к вам можно обращаться? Напишите, пожалуйста, ваше ФИО.`;
            const namePrompt = await getLocalizedText(currentLang, namePromptRu);

            await saveMessage(telegramId, 'assistant', finalResponse);

            // Send photos album first
            await sendExcursionPhotos(selectedEx);

            try {
                await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
            } catch (e) {
                await ctx.reply(finalResponse);
            }
            return ctx.reply(namePrompt);
        }
    }

    if (!finalResponse || finalResponse.trim() === '') {
        finalResponse = 'Пожалуйста, подожди минуту или напиши по-другому.';
    }

    // Check if AI response mentions an excursion → cache it and send photos
    if (excursions) {
        const cleanText = finalResponse.toLowerCase().replace(/[\*\_\`\#]/g, '');
        const mentionedEx = excursions.find(e => {
            const title = e.title.toLowerCase();
            return cleanText.includes(title) || (title.length > 5 && cleanText.includes(title.substring(0, title.length - 2)));
        });
        
        if (mentionedEx) {
            console.log(`[AI] Mentioned Excursion: ${mentionedEx.title}`);
            lastShownExcursion[telegramId] = mentionedEx.id;
            await sendExcursionPhotos(mentionedEx);
        }
    }

        await saveMessage(telegramId, 'assistant', finalResponse);
        try {
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
        } catch (mdError) {
            console.warn('[GENERIC] Markdown fallback:', mdError.message);
            await ctx.reply(finalResponse);
        }

    } catch (err) {
        console.error('CRITICAL BOT ERROR:', err);
        try { await ctx.reply('Извини, произошла ошибка. Попробуй позже.'); } catch (e) { }
    }
});

// Запуск
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    bot.launch().then(() => console.log('Excursion Bot with AI Multi-Agents is running...'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
