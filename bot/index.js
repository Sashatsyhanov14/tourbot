const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const { supabase, getUser, createUser, getExcursions, saveMessage, getHistory, createRequest, getFaq, clearHistory } = require('./src/supabase');
const { getChatResponse, getLocalizedText, getManagerReport } = require('./src/openai');

dotenv.config({ path: path.resolve(__dirname, './.env') });

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

// --- HELPER: Unified Booking Notification ---
async function sendBookingAlert(order, userData, bookingDetails, origin = 'AI Chat') {
    if (!order || !order.id) {
        console.error('[sendBookingAlert] Skipping alert: order is null or invalid (likely DB insertion failed)');
        return;
    }
    try {
        const { data: history } = await getHistory(userData.telegram_id, 10);
        const { data: excursions } = await getExcursions();
        const selectedEx = excursions ? excursions.find(e => e.id === order.excursion_id) : null;

        const aiReport = await getManagerReport(userData, history, selectedEx, bookingDetails, origin);
        
        // Direct link to user (t.me/username is much more reliable than tg://user?id)
        const userLink = userData.username 
            ? `https://t.me/${userData.username.replace('@', '')}` 
            : `tg://user?id=${userData.telegram_id}`;

        const userLang = userLangCache[userData.telegram_id] || 'ru';
        const header = `👤 **Клиент:** ${userData.username ? '@'+userData.username : 'Без юзернейма'} (\`${userData.telegram_id}\`)\n🌐 **Язык:** ${userLang.toUpperCase()}\n🔗 [Открыть профиль](${userLink})\n`;
        const fullReport = header + '\n' + aiReport;

        const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'admin', 'manager']);
        
        const inlineKeyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Принять', `accept_req_${order.id}`),
                Markup.button.callback('❌ Отклонить', `cancel_req_${order.id}`)
            ],
            [
                Markup.button.callback('💰 Начислить бонусы', `bonus_req_${order.id}`)
            ]
        ]);

        if (managers && managers.length > 0) {
            for (const m of managers) {
                try {
                    await bot.telegram.sendMessage(m.telegram_id, fullReport, { 
                        parse_mode: 'Markdown',
                        ...inlineKeyboard
                    });
                } catch (e) {
                    try {
                        await bot.telegram.sendMessage(m.telegram_id, fullReport.replace(/[\*_`\[\]()]/g, ''), inlineKeyboard);
                    } catch (e2) { console.error(`[MANAGER_NOTIFY_ERROR] to ${m.telegram_id}: ${e2.message}`); }
                }
            }
        } else {
            console.warn('[sendBookingAlert] No managers found in DB.');
        }
    } catch (err) {
        console.error('[sendBookingAlert] Fatal Error:', err.message);
    }
}

// --- MANAGER ACTIONS ---
bot.action(/^accept_req_(.+)$/, async (ctx) => {
    const requestId = ctx.match[1];
    const managerId = ctx.from.id;

    const { data: manager } = await getUser(managerId);
    if (!manager || (manager.role !== 'founder' && manager.role !== 'manager' && manager.role !== 'admin')) {
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
    if (!manager || (manager.role !== 'founder' && manager.role !== 'manager' && manager.role !== 'admin')) {
        return ctx.answerCbQuery('❌ Нет прав.', { show_alert: true });
    }

    const { data: request } = await supabase.from('requests').select('*').eq('id', requestId).single();
    if (!request) return ctx.answerCbQuery('❌ Заявка не найдена.', { show_alert: true });

    try {
        // Use referrer_id stored directly on the request at booking time
        const referrerId = request.referrer_id;
        const price = request.price_usd || 0;
        
        if (referrerId && price) {
            const rewardPercentage = 0.01; // 1% for tours
            const reward = Math.round((price * rewardPercentage) * 100) / 100;
            const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', referrerId).single();
            const newBalance = Math.round(((refUser?.balance || 0) + reward) * 100) / 100;
            await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', referrerId);
            
            // Log commission for WebApp analytics
            await supabase.from('chat_history').insert({
                user_id: referrerId,
                role: 'assistant',
                content: `COMMISSION_RECORD:${reward}:request_${requestId}:buyer_${request.user_id}`,
                created_at: new Date().toISOString()
            }).catch(e => console.error('Commission log error:', e.message));


            await ctx.editMessageText(
                ctx.callbackQuery.message.text + `\n\n💰 БОНУС $${reward} начислен рефереру (ID: ${referrerId})`,
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

bot.action(/^start_chat_book_(.+)$/, async (ctx) => {
    const excursionId = ctx.match[1];
    const telegramId = ctx.from.id;
    await startBookingStepper(ctx, telegramId, excursionId);
});

async function startBookingStepper(ctx, telegramId, excursionId) {
    userStates.set(telegramId, { step: 'name', excursionId, data: {} });
    const lang = userLangCache[telegramId] || 'ru';
    const namePromptRu = `С радостью подготовлю для вас бронь! 😍\n\n👤 Как к вам можно обращаться? Напишите, пожалуйста, ваше ФИО.`;
    const namePrompt = await getLocalizedText(lang, namePromptRu);
    
    if (ctx.callbackQuery) {
        try { await ctx.answerCbQuery(); } catch (e) {}
    }
    return ctx.reply(namePrompt, Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel_stepper')]]));
}

bot.action('cancel_stepper', async (ctx) => {
    userStates.delete(ctx.from.id);
    const lang = userLangCache[ctx.from.id] || 'ru';
    const msg = await getLocalizedText(lang, '❌ Бронирование отменено. Если возникнут вопросы — я на связи! 😊');
    await ctx.answerCbQuery('Отменено');
    return ctx.editMessageText(msg, Markup.inlineKeyboard([]));
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
        } else if (startPayload && !isNaN(startPayload) && !user.referrer_id) {
            // Existing user without a referrer came via a referral link — assign now
            const rId = parseInt(startPayload);
            if (rId !== telegramId) {
                await supabase.from('users').update({ referrer_id: rId }).eq('telegram_id', telegramId);
                user.referrer_id = rId;
                console.log(`[START] Assigned referrer ${rId} to existing user ${telegramId}`);
            }
        }

        const lang = ctx.from.language_code || 'ru';
        userLangCache[telegramId] = lang;

        const welcomeRuPart1 = `Добро пожаловать в солнечную Турцию! ☀️\n\nЯ твой персональный гид и ассистент по отдыху. Помогу выбрать лучшую экскурсию, расскажу о самых красивых маршрутах и отвечу на любые вопросы.\n\nДавай начнем! Открой каталог ниже или просто напиши: какой город или развлечение тебя интересует? 🗺️`;

        const welcomeText1 = await getLocalizedText(lang, welcomeRuPart1);
        const webappBtnRu = '🎒 Открыть Каталог';
        const qrBtnRu = '📲 Мой QR / Промокод';
        const webappBtn = await getLocalizedText(lang, webappBtnRu);
        const qrBtn = await getLocalizedText(lang, qrBtnRu);
        // Remove any existing keyboard as requested by user
        try {
            const k = await ctx.reply('…', Markup.removeKeyboard());
            await bot.telegram.deleteMessage(ctx.chat.id, k.message_id);
        } catch (e) { }
        
        await ctx.reply(welcomeText1);
        console.log(`[START] Welcome Part 1 sent to ${username}`);

        // Задержанное 2-е сообщение
        setTimeout(async () => {
            try {
                const welcomeRuPart2 = `📍 Мы работаем во всех популярных городах: Стамбул, Аланья, Анталья, Кемер, Сиде, Белек, Мармарис, Фетхие и Каппадокия.\n\nПросто напиши название города — и я покажу лучшие варианты! Или выбери экскурсию в каталоге прямо сейчас 👆`;
                const welcomeText2 = await getLocalizedText(lang, welcomeRuPart2);
                await bot.telegram.sendMessage(telegramId, welcomeText2);
                console.log(`[START] Welcome Part 2 sent to ${username}`);
            } catch (err) {
                console.error('[START Part 2] Error:', err.message);
            }
        }, 2200);

    } catch (err) {
        console.error('[START] Fatal Error:', err.message);
        try { await ctx.reply('Привет! Я гид по экскурсиям. Напиши город или открой каталог!'); } catch (e) { }
    }
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const lang = userLangCache[telegramId] || 'ru';
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${telegramId}`;

    const textRu = `🎁 Твоя персональная ссылка для друзей:\n\n${refLink}\n\nТвой промокод: \`${telegramId}\`\n\nДелись ею с друзьями! За каждую забронированную ими экскурсию ты получишь бонус $1 на свой баланс. Давай открывать Турцию вместе! 🌍`;
    const text = await getLocalizedText(lang, textRu);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    try {
        await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
    } catch (err) {
        await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
});

// --- WEB APP DATA (sendData from mini-app buttons) ---
bot.on('message', async (ctx, next) => {
    const dataStr = ctx.message?.web_app_data?.data;
    if (dataStr) {
        console.log(`[WEB_APP_DATA_RECEIVED] From ${ctx.from?.id}: ${dataStr}`);
        await handleWebAppData(ctx, dataStr);
        return;
    }
    return next();
});

async function handleWebAppData(ctx, dataStr) {
    const telegramId = ctx.from?.id;
    const lang = userLangCache[telegramId] || 'ru';

    try {
        let data;
        try {
            data = JSON.parse(dataStr);
        } catch (jsonErr) {
            console.error(`[handleWebAppData] JSON Parse Error: ${jsonErr.message}`);
            return;
        }

        console.log(`[HANDLE_DATA] Type: ${data.type}`, data);
        
        // --- Quick Booking from Catalog ---
        if (data.type === 'quick_book') {
            console.log('[BOOKING_DEBUG] Received quick_book data:', data);
            let { excursionId, excursionTitle, fullName, phone, tourDate, priceUsd, hotelName } = data;
            
            // If title is missing (simplified payload), fetch from DB
            if (!excursionTitle && excursionId) {
                console.log('[BOOKING_DEBUG] Fetching excursion details for ID:', excursionId);
                const { data: ex, error: exErr } = await supabase.from('excursions').select('title, price_usd').eq('id', excursionId).single();
                if (ex) {
                    excursionTitle = ex.title;
                    priceUsd = ex.price_usd;
                } else {
                    console.error('[BOOKING_DEBUG] Excursion not found or error:', exErr);
                }
            }

            const { data: user } = await getUser(telegramId);
            console.log('[BOOKING_DEBUG] User found:', !!user, telegramId);

            // Create request using the unified helper
            console.log('[BOOKING_DEBUG] Creating request in Supabase...');
            const { data: order, error: insErr } = await createRequest(
                telegramId,
                excursionId,
                excursionTitle || 'Unknown Excursion',
                fullName,
                tourDate,
                hotelName || 'WebApp Catalog', 
                priceUsd || data.price_usd || 0,
                phone,
                user?.referrer_id || null
            );

            if (insErr) {
                console.error('[BOOKING_INSERT_ERROR] Fatal:', insErr);
                return ctx.reply('❌ Ошибка при сохранении заявки в базу. Пожалуйста, сообщите администратору.');
            }

            console.log('[BOOKING_DEBUG] Request created successfully, ID:', order?.id);

            // Notify Managers using unified helper
            try {
                console.log('[BOOKING_DEBUG] Sending alert to managers...');
                await sendBookingAlert(order, user || { telegram_id: telegramId, username: ctx.from?.username }, {
                    fullName: fullName,
                    phone: phone,
                    tourDate: tourDate,
                    hotelName: hotelName || 'WebApp Catalog'
                }, 'Mini App Catalog');
                console.log('[BOOKING_DEBUG] Alerts sent!');
            } catch (alertErr) {
                console.error('[BOOKING_DEBUG] Alert failed:', alertErr.message);
            }

            const successRu = '✅ *Заявка отправлена!*\n\nНаш менеджер свяжется с вами в ближайшее время. Спасибо!';
            const successMsg = await getLocalizedText(lang, successRu);
            try { return await ctx.reply(successMsg, { parse_mode: 'Markdown' }); } catch (e) { return ctx.reply(successMsg); }
        }

        // --- AI Auto Translate Excursion ---
        if (data.type === 'auto_translate_excursion') {
            const { excursionId, data: exData } = data;
            const languages = ['en', 'tr', 'de', 'pl', 'ar', 'fa'];
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
                if (error) {
                    console.error('[AI_TRANSLATE] Update error:', error.message);
                    return ctx.reply(`❌ Ошибка сохранения перевода: ${error.message}`);
                }
                else console.log(`[AI_TRANSLATE] Updated excursion ${excursionId} success! (Fields: ${Object.keys(updates).length})`);
            }

            const confirmMsg = `✅ *AI Перевод завершен!*\n\nЯ подготовил описание на всех языках:\n🇬🇧 English\n🇹🇷 Turkish\n🇩🇪 German\n🇵🇱 Polish\n🇸🇦 Arabic\n🇮🇷 Persian\n\n_Обновите страницу в Mini App, чтобы увидеть результат._`;
            return ctx.reply(confirmMsg, { parse_mode: 'Markdown' });
        }

        // --- Bulk Translate All ---
        if (data.type === 'bulk_translate_all') {
            const { data: excursions } = await supabase.from('excursions').select('*');
            if (!excursions || excursions.length === 0) return ctx.reply('❌ Экскурсии не найдены.');

            ctx.reply(`🚀 *Начинаю массовый перевод всего каталога (${excursions.length} шт.)...*\nЭто может занять время, я сообщу о результате.`, { parse_mode: 'Markdown' });

            const targetLangs = ['en', 'tr', 'de', 'pl', 'ar', 'fa'];
            const fields = ['title', 'city', 'description', 'duration', 'included', 'meeting_point'];
            let updatedCount = 0;

            for (const ex of excursions) {
                const updates = {};
                for (const lang of targetLangs) {
                    for (const field of fields) {
                        const targetKey = `${field}_${lang}`;
                        if (!ex[targetKey] && ex[field]) {
                            const translated = await getLocalizedText(lang, ex[field]);
                            if (translated && translated !== ex[field]) {
                                updates[targetKey] = translated;
                            }
                        }
                    }
                }

                if (Object.keys(updates).length > 0) {
                    const { error } = await supabase.from('excursions').update(updates).eq('id', ex.id);
                    if (!error) updatedCount++;
                }
            }

            return ctx.reply(`✨ *Массовый перевод завершен!*\n\nОбновлено экскурсий: *${updatedCount}* из *${excursions.length}*.\nВсе языки (En, Tr, De, Pl, Ar, Fa) теперь заполнены!`, { parse_mode: 'Markdown' });
        }

        // --- Withdraw Request ---
        if (data.type === 'withdraw_request') {
            const { amount, method } = data;
            
            // 1. Get all managers and founders from the DB
            const { data: staff } = await supabase.from('users').select('telegram_id').in('role', ['manager', 'admin', 'founder']);
            
            // 2. Prepare notification list (always include ADMIN_ID from .env just in case)
            const recipientIds = new Set((staff || []).map(s => s.telegram_id));
            if (process.env.ADMIN_ID) recipientIds.add(process.env.ADMIN_ID);
            if (process.env.MANAGER_ID) recipientIds.add(process.env.MANAGER_ID);

            const adminNotify = `👤 *Клиент:* @${ctx.from.username || 'unknown'} (\`${telegramId}\`)\n💰 *ЗАПРОС НА ВЫВОД БОНУСОВ*\n\n💵 Сумма: *${amount} $* \n💳 Реквизиты: \`${method}\` \n\n_Пожалуйста, проведите выплату и свяжитесь с клиентом._`;
            
            // 3. Broadcast to all recipients
            for (const mId of recipientIds) {
                try {
                    await ctx.telegram.sendMessage(mId, adminNotify, { parse_mode: 'Markdown' });
                } catch (e) {
                    console.error(`[WITHDRAW_BROADCAST_ERROR] to ${mId}:`, e.message);
                }
            }
            return;
        }
    } catch (e) {
        console.error(`[HANDLE_DATA_FATAL_ERROR] ${e.message}`, e);
        // Fallback for QR keywords if not JSON
        if (typeof dataStr === 'string' && (QR_KEYWORDS.some(kw => dataStr.toLowerCase().includes(kw)) || dataStr.includes('QR'))) {
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
        
        // --- SMART ESCAPE: Если похоже на вопрос или смену темы ---
        const questionWords = ['как', 'где', 'что', 'когда', 'почему', 'сколько', 'цена', 'стоимость', 'далеко', 'какой', 'какие', 'есть', 'можно'];
        const lowerText = userText.toLowerCase();
        const isQuestion = 
            userText.includes('?') || 
            userText.length > 50 || 
            questionWords.some(w => lowerText.includes(w)) ||
            ['нет', 'отмена', 'не надо', 'передумал', 'погоди'].some(w => lowerText.includes(w));

        const cancelBtn = [Markup.button.callback('❌ Отмена', 'cancel_stepper')];

        if (isQuestion) {
            userStates.delete(telegramId);
            // Проваливаемся ниже в AI чат
        } else {
            if (state.step === 'name') {
                state.data.fullName = userText;
                state.step = 'date';
                const msg = await getLocalizedText(lang, '🗓️ Отлично! Теперь напишите желаемую дату поездки (например: завтра, 25 мая, или удобный вам период):');
                return ctx.reply(msg, Markup.inlineKeyboard([cancelBtn]));
            }

            if (state.step === 'date') {
                state.data.tourDate = userText;
                state.step = 'hotel';
                const msg = await getLocalizedText(lang, '🏨 Принято. Напишите, пожалуйста, в каком отеле вы остановились (или адрес), чтобы мы знали, откуда вас забрать:');
                return ctx.reply(msg, Markup.inlineKeyboard([cancelBtn]));
            }

            if (state.step === 'hotel') {
                state.data.hotelName = userText;
                state.step = 'phone';
                const msg = await getLocalizedText(lang, '📲 И последний штрих! Укажите ваш номер WhatsApp — менеджер свяжется для подтверждения и пришлет все детали:');
                return ctx.reply(msg, Markup.inlineKeyboard([cancelBtn]));
            }

            if (state.step === 'phone') {
                state.data.phone = userText;
            const excursionId = state.excursionId;

            const { data: excursions } = await getExcursions();
            const selectedEx = excursions ? excursions.find(e => e.id === excursionId) : null;

            const { data: user } = await getUser(telegramId);

            const { data: order, error: insErr } = await createRequest(
                telegramId,
                state.data.excursionId,
                state.data.excursionTitle,
                state.data.fullName,
                state.data.tourDate,
                userText, // Hotel name
                state.data.price_usd || 0,
                state.data.phone,
                user?.referrer_id || null
            );

            userStates.delete(telegramId);

            const thanksRu = `Все готово! ✨ Ваша заявка отправлена. Наш оператор свяжется с вами по номеру ${userText} в самое ближайшее время. Приятного вам отдыха! 🙌`;
            const thanksMsg = await getLocalizedText(lang, thanksRu);
            await ctx.reply(thanksMsg);

            // --- 2-minute follow-up upsell ---
            setTimeout(async () => {
                try {
                    const followUpRu = `Спасибо за ваш интерес и уделённое время! 🙏\nЖелаем вам приятного путешествия! ✈️\n\nВаша заявка уже у нас — оператор подтвердит все детали в ближайшее время. Экскурсия пройдёт незабываемо! 🗺️\n\nРекомендуем установить приложение eMedeo — цифровая платформа с прозрачными ценами, отзывами и поддержкой 24/7 🤖\n\nИИ от eMedeo поможет вам:\n• Оформить трансфер 🚗\n• Арендовать автомобиль или жильё 🏡\n• Купить eSIM для интернета 📱\n• Совершить покупки 🛍️\n• Получить юридические и консультационные услуги ⚖️\n\n— Мир без посредников —\n\nМы всегда на связи — чат поддержки 24/7 💬\n\nНаше приложение:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\niOS: https://apps.apple.com/app/emedeo/id6738978452`;
                    const followUpMsg = await getLocalizedText(lang, followUpRu);
                    await bot.telegram.sendMessage(telegramId, followUpMsg, { disable_web_page_preview: true });
                } catch (e) {
                    console.error('[FOLLOWUP] Error sending follow-up:', e.message);
                }
            }, 2 * 60 * 1000); // 2 minutes

            // Уведомление менеджерам через единый хелпер
            await sendBookingAlert(order, user, state.data, 'AI Voice/Chat Bot');
            return;
            }
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

        const langMatch = aiResponse.match(/\[LANG:\s*([a-z]{2})\]/i);
        if (langMatch) {
            const newLang = langMatch[1].toLowerCase();
            if (userLangCache[telegramId] !== newLang) {
                userLangCache[telegramId] = newLang;
                await supabase.from('users').update({ language_code: newLang }).eq('telegram_id', telegramId).catch(() => {});
            }
        }

        const intentMatch = aiResponse.match(/\[INTENT:\s*([a-z_]+)\]/i);
        const exMatch = aiResponse.match(/\[EXCURSION_ID:\s*([a-zA-Z0-9_-]+)\]/i);
        const bookMatch = aiResponse.match(/\[BOOK_REQUEST:\s*([a-zA-Z0-9_-]+)\]/i);
        
        let finalResponse = aiResponse
            .replace(/\[EXCURSION_ID:.*?\]/gi, '')
            .replace(/\[BOOK_REQUEST:.*?\]/gi, '')
            .replace(/\[LANG:.*?\]/gi, '')
            .replace(/\[INTENT:.*?\]/gi, '')
            .trim();

        if (exMatch) {
            const excursionId = exMatch[1].trim();
            const selectedEx = (excursions || []).find(e => e.id === excursionId);

            if (selectedEx) {
                lastShownExcursion[telegramId] = excursionId;
                
                // Show photos immediately when excursion is mentioned/shown
                await sendExcursionPhotos(telegramId, selectedEx);
                
                // If starting a sale, send confirms THEN stepper
                if (intentMatch && intentMatch[1].toLowerCase() === 'sale') {
                    await saveMessage(telegramId, 'assistant', finalResponse);
                    try { await ctx.reply(finalResponse, { parse_mode: 'Markdown' }); } catch (e) { await ctx.reply(finalResponse); }
                    await startBookingStepper(ctx, telegramId, excursionId);
                    return;
                }
            }
        }

        if (!finalResponse || finalResponse.trim() === '') {
            finalResponse = 'Извините, я задумался. Повторите, пожалуйста, ваш вопрос.';
        }

        // --- SMART PHOTO DETECTION ---
        const PHOTO_KEYWORDS = ['фото', 'photo', 'resim', 'fotoğraf', 'покажи', 'картинк', 'picture', 'image'];
        const isPhotoRequest = PHOTO_KEYWORDS.some(kw => userText.toLowerCase().includes(kw));
        
        if (excursions) {
            const cleanText = finalResponse.toLowerCase();
            let targetEx = null;

            // 1. Priority: If AI explicitly identified the excursion (bookMatch)
            if (bookMatch) {
                const exId = bookMatch[1].trim();
                targetEx = excursions.find(e => e.id === exId);
                console.log(`[PHOTO_DEBUG] ID Match Found: ${exId} -> ${targetEx?.title || 'Not Found'}`);
            }

            // 2. Fallback: Smart matching by title or city in AI response
            if (!targetEx) {
                targetEx = excursions.find(ex => 
                    cleanText.includes(ex.title.toLowerCase()) || 
                    (ex.city && cleanText.includes(ex.city.toLowerCase()))
                );
                if (targetEx) console.log(`[PHOTO_DEBUG] Text Match Found: ${targetEx.title}`);
            }

            // 3. Last Resort: Use last shown excursion if just "show photos" was asked
            if (!targetEx && isPhotoRequest && lastShownExcursion[telegramId]) {
                targetEx = excursions.find(e => e.id === lastShownExcursion[telegramId]);
                if (targetEx) console.log(`[PHOTO_DEBUG] Cache Match Found: ${targetEx.title}`);
            }

            // Execution: Send if we found an excursion AND it's either a photo request OR a booking start
            if (targetEx && (isPhotoRequest || bookMatch)) {
                console.log(`[PHOTO_DEBUG] Triggering send for ${targetEx.title}. isPhotoRequest: ${isPhotoRequest}, bookMatch: ${!!bookMatch}`);
                lastShownExcursion[telegramId] = targetEx.id;
                await sendExcursionPhotos(telegramId, targetEx);
            } else {
                console.log(`[PHOTO_DEBUG] No trigger. targetEx: ${targetEx?.title || 'None'}, isPhotoRequest: ${isPhotoRequest}, bookMatch: ${!!bookMatch}`);
            }
        }

        await saveMessage(telegramId, 'assistant', finalResponse);
        
        try {
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
        } catch (err) {
            await ctx.reply(finalResponse);
        }

    } catch (error) {
        console.error('[OpenAI Fatal Error]:', error.message);
        if (error.response) {
            console.error('[OpenAI Status]:', error.response.status);
            console.error('[OpenAI Data]:', error.response.data);
        }
        try { 
            const lang = userLangCache[telegramId] || 'ru';
            const errMsgRu = 'Извини, произошла ошибка. Попробуй чуть позже. 🙏';
            const errMsg = await getLocalizedText(lang, errMsgRu);
            await ctx.reply(errMsg); 
        } catch (e) { }
    }
});

// Helper: send all photos of an excursion as album
async function sendExcursionPhotos(telegramId, ex) {
    const photos = (ex.image_urls && Array.isArray(ex.image_urls))
        ? ex.image_urls.filter(url => url && url.startsWith('http'))
        : (ex.image_url ? [ex.image_url] : []);

    if (photos.length === 0) return;

    try {
        if (photos.length === 1) {
            await bot.telegram.sendPhoto(telegramId, photos[0]);
        } else {
            const media = photos.slice(0, 10).map(url => ({ type: 'photo', media: url }));
            await bot.telegram.sendMediaGroup(telegramId, media);
        }
    } catch (e) {
        console.warn('[MediaGroup] Error:', e.message);
    }
}

// Запуск
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    bot.launch().then(() => console.log('Excursion Bot with AI Multi-Agents is running...'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
module.exports.handleWebAppData = handleWebAppData;
