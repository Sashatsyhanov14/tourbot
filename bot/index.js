const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const { supabase, getUser, createUser, getExcursions, saveMessage, getHistory, createRequest, getFaq, clearHistory, getLangFromHistory } = require('./src/supabase');
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

// --- HELPER: Unified Localized Responder ---
async function reply(ctx, ruText, extra = {}) {
    const telegramId = ctx.from?.id || ctx.chat?.id;
    if (!telegramId) return ctx.reply(ruText, extra);
    
    // Priority: History Lang -> Cache -> System Lang -> RU
    const lang = await getLangFromHistory(telegramId) || userLangCache[telegramId] || (ctx.from && ctx.from.language_code) || 'ru';
    
    const localizedText = await getLocalizedText(lang, ruText);
    return ctx.reply(localizedText, extra);
}

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

        // Get manager language (default RU for manager reports unless specified)
        const aiReport = await getManagerReport(userData, history, selectedEx, bookingDetails, origin, 'ru');
        
        const userLink = userData.username 
            ? `https://t.me/${userData.username.replace('@', '')}` 
            : `tg://user?id=${userData.telegram_id}`;

        const isRealUsername = userData.username && !userData.username.includes(' ') && userData.username === userData.username.toLowerCase();
        const clientDisplayName = userData.username 
            ? (isRealUsername ? `@${userData.username}` : userData.username) 
            : (bookingDetails.fullName || 'Без юзернейма');

        const userLang = await getLangFromHistory(userData.telegram_id);
        const header = `👤 **Клиент:** ${clientDisplayName} (\`${userData.telegram_id}\`)\n🌐 **Язык:** ${userLang.toUpperCase()}\n🔗 [Открыть профиль](${userLink})\n`;

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
    if (!manager || (manager.role !== 'founder' && manager.role !== 'manager' && manager.role !== 'admin')) {
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
        const referrerId = request.referrer_id;
        const price = request.price_usd || 0;
        
        if (referrerId && price) {
            const rewardPercentage = 0.01; 
            const reward = Math.round((price * rewardPercentage) * 100) / 100;
            const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', referrerId).single();
            const newBalance = Math.round(((refUser?.balance || 0) + reward) * 100) / 100;
            await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', referrerId);
            
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
    const { data: excursions } = await getExcursions();
    const ex = excursions?.find(e => e.id === excursionId);
    
    userStates.set(telegramId, { 
        step: 'name', 
        excursionId, 
        data: {
            excursionTitle: ex?.title || 'Unknown',
            price_usd: ex?.price_usd || 0
        } 
    });
    
    if (ctx.callbackQuery) {
        try { await ctx.answerCbQuery(); } catch (e) {}
    }
    const namePromptRu = `С радостью подготовлю для вас бронь! 😍\n\n👤 Как к вам можно обращаться? Напишите, пожалуйста, ваше ФИО.`;
    return reply(ctx, namePromptRu, Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel_stepper')]]));
}

bot.action('cancel_stepper', async (ctx) => {
    userStates.delete(ctx.from.id);
    const msgRu = '❌ Бронирование отменено. Если возникнут вопросы — я на связи! 😊';
    await ctx.answerCbQuery('Отменено');
    return reply(ctx, msgRu, Markup.inlineKeyboard([]));
});

// --- CLIENT FLOW ---
bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const realUsername = ctx.from.username; 
    const displayName = ctx.from.first_name || (realUsername ? `@${realUsername}` : `User ${telegramId}`);
    const startPayload = ctx.payload;

    try {
        console.log(`[START] Triggered for ${displayName} (${telegramId}), payload: ${startPayload}`);

        const lang = ctx.from.language_code || 'ru';
        userLangCache[telegramId] = lang;

        userStates.delete(telegramId);
        await clearHistory(telegramId);

        let { data: user } = await getUser(telegramId);
        if (!user) {
            const referrerId = startPayload && !isNaN(startPayload) ? parseInt(startPayload) : null;
            const { data: newUser } = await createUser({
                telegram_id: telegramId,
                username: realUsername || displayName,
                role: 'user',
                referrer_id: (referrerId && referrerId !== telegramId) ? referrerId : null,
                balance: 0,
                language_code: lang
            });
            user = newUser;
        } else {
            await supabase.from('users').update({ language_code: lang }).eq('telegram_id', telegramId).catch(() => {});
            if (startPayload && !isNaN(startPayload) && !user.referrer_id) {
                const rId = parseInt(startPayload);
                if (rId !== telegramId) {
                    await supabase.from('users').update({ referrer_id: rId }).eq('telegram_id', telegramId);
                    user.referrer_id = rId;
                }
            }
        }

        const welcomeRuPart1 = `Добро пожаловать в солнечную Турцию! ☀️\n\nЯ твой персональный гид и ассистент по отдыху. Помогу выбрать лучшую экскурсию, расскажу о самых красивых маршрутах и отвечу на любые вопросы.\n\nДавай начнем! Открой каталог ниже или просто напиши: какой город или развлечение тебя интересует? 🗺️`;
        
        try {
            const k = await ctx.reply('…', Markup.removeKeyboard());
            await bot.telegram.deleteMessage(ctx.chat.id, k.message_id);
        } catch (e) { }
        
        await reply(ctx, welcomeRuPart1);

        setTimeout(async () => {
            const welcomeRuPart2 = `📍 Мы работаем во всех популярных городах: Стамбул, Аланья, Анталья, Кемер, Сиде, Белек, Мармарис, Фетхие и Каппадокия.\n\nПросто напиши название города — и я покажу лучшие варианты! Или выбери экскурсию в каталоге прямо сейчас 👆`;
            await reply(ctx, welcomeRuPart2);
        }, 2200);

    } catch (err) {
        console.error('[START] Fatal Error:', err.message);
        try { await reply(ctx, 'Привет! Я гид по экскурсиям. Напиши город или открой каталог!'); } catch (e) { }
    }
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${telegramId}`;
    const textRu = `🎁 Твоя персональная ссылка для друзей:\n\n${refLink}\n\nТвой промокод: \`${telegramId}\`\n\nДелись ею с друзьями! За каждую забронированную ими экскурсию ты получишь бонус $1 на свой баланс. Давай открывать Турцию вместе! 🌍`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    const lang = await getLangFromHistory(telegramId);
    const text = await getLocalizedText(lang, textRu);

    try {
        await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
    } catch (err) {
        await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
});

// --- WEB APP DATA ---
bot.on('message', async (ctx, next) => {
    const dataStr = ctx.message?.web_app_data?.data;
    if (dataStr) {
        await handleWebAppData(ctx, dataStr);
        return;
    }
    return next();
});

async function handleWebAppData(ctx, dataStr) {
    const telegramId = ctx.from?.id;
    try {
        let data = JSON.parse(dataStr);
        
        if (data.type === 'quick_book') {
            let { excursionId, excursionTitle, fullName, phone, tourDate, priceUsd, hotelName } = data;
            const { data: user } = await getUser(telegramId);
            const { data: order, error: insErr } = await createRequest(
                telegramId, excursionId, excursionTitle || 'Unknown', fullName, tourDate, hotelName || 'WebApp Catalog', priceUsd || 0, phone, user?.referrer_id || null
            );

            if (insErr) return reply(ctx, '❌ Ошибка при сохранении заявки в базу.');

            await sendBookingAlert(order, user || { telegram_id: telegramId, username: ctx.from?.username }, { fullName, phone, tourDate, hotelName: hotelName || 'WebApp Catalog' }, 'Mini App Catalog');

            const successRu = '✅ *Заявка отправлена!*\n\nНаш менеджер свяжется с вами в ближайшее время. Спасибо!';
            return reply(ctx, successRu, { parse_mode: 'Markdown' });
        }

        if (data.type === 'auto_translate_excursion') {
            const { excursionId, data: exData } = data;
            const targetLangs = ['en', 'tr', 'de', 'pl', 'ar', 'fa'];
            const fields = ['title', 'city', 'description', 'duration', 'included', 'meeting_point'];
            const updates = {};

            for (const tLang of targetLangs) {
                for (const field of fields) {
                    if (exData[field]) {
                        const translated = await getLocalizedText(tLang, exData[field]);
                        if (translated && translated !== exData[field]) updates[`${field}_${tLang}`] = translated;
                    }
                }
            }

            if (Object.keys(updates).length > 0 && excursionId !== 'new') {
                await supabase.from('excursions').update(updates).eq('id', excursionId);
            }
            return reply(ctx, '✅ *AI Перевод завершен!*');
        }
    } catch (e) { console.error(`[HANDLE_DATA_ERROR] ${e.message}`); }
}

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    const userText = ctx.message.text.trim();
    const state = userStates.get(telegramId);

    const isQrRequest = (userQrBtnCache[telegramId] && userText === userQrBtnCache[telegramId]) || QR_KEYWORDS.some(kw => userText.toLowerCase().includes(kw));

    if (isQrRequest) {
        const lang = await getLangFromHistory(telegramId);
        const refLink = `https://t.me/${ctx.botInfo?.username}?start=${telegramId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(refLink)}&margin=15&bgcolor=ffffff`;
        const captionRu = `🔗 *Link:* \`${refLink}\`\n🎫 *Promo:* \`${telegramId}\`\n\n✨ Поделитесь этим QR или промокодом — и получайте бонусы за каждого друга!`;
        const caption = await getLocalizedText(lang, captionRu);
        try { await ctx.replyWithPhoto(qrUrl, { caption, parse_mode: 'Markdown' }); } catch (e) { await reply(ctx, captionRu, { parse_mode: 'Markdown' }); }
        return;
    }

    if (state) {
        const cancelBtn = [Markup.button.callback('❌ Отмена', 'cancel_stepper')];

        if (state.step === 'name') {
            state.data.fullName = userText; state.step = 'date';
            return reply(ctx, '🗓️ Отлично! Теперь напишите желаемую дату поездки (например: завтра, 25 мая, или удобный вам период):', Markup.inlineKeyboard([cancelBtn]));
        }
        if (state.step === 'date') {
            state.data.tourDate = userText; state.step = 'hotel';
            return reply(ctx, '🏨 Принято. Напишите, пожалуйста, в каком отеле вы остановились (или адрес), чтобы мы знали, откуда вас забрать:', Markup.inlineKeyboard([cancelBtn]));
        }
        if (state.step === 'hotel') {
            state.data.hotelName = userText; state.step = 'phone';
            return reply(ctx, '📲 И последний штрих! Укажите ваш номер WhatsApp — менеджер свяжется для подтверждения и пришлет все детали:', Markup.inlineKeyboard([cancelBtn]));
        }
        if (state.step === 'phone') {
            state.data.phone = userText;
            const { data: user } = await getUser(telegramId);
            const { data: order } = await createRequest(telegramId, state.excursionId, state.data.excursionTitle, state.data.fullName, state.data.tourDate, state.data.hotelName, state.data.price_usd || 0, userText, user?.referrer_id || null);
            userStates.delete(telegramId);
            
            await reply(ctx, `Все готово! ✨ Ваша заявка отправлена. Наш оператор свяжется с вами в самое ближайшее время. Приятного вам отдыха! 🙌`);
            
            // --- 2-minute follow-up upsell (Localized) ---
            setTimeout(async () => {
                try {
                    const followUpRu = `Спасибо за ваш интерес и уделённое время! 🙏\nЖелаем вам приятного путешествия! ✈️\n\nВаша заявка уже у нас — оператор подтвердит все детали в ближайшее время. Экскурсия пройдёт незабываемо! 🗺️\n\nРекомендуем установить приложение eMedeo — цифровая платформа с прозрачными ценами, отзывами и поддержкой 24/7 🤖\n\nИИ от eMedeo поможет вам:\n• Оформить трансфер 🚗\n• Арендовать автомобиль или жильё 🏡\n• Купить eSIM для интернета 📱\n• Совершить покупки 🛍️\n• Получить юридические и консультационные услуги ⚖️\n\n— Мир без посредников —\n\nМы всегда на связи — чат поддержки 24/7 💬\n\nНаше приложение:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\niOS: https://apps.apple.com/app/emedeo/id6738978452`;
                    const currentLang = await getLangFromHistory(telegramId);
                    const localizedMsg = await getLocalizedText(currentLang, followUpRu);
                    await bot.telegram.sendMessage(telegramId, localizedMsg, { disable_web_page_preview: true });
                } catch (e) { console.error('[FOLLOWUP] Error:', e.message); }
            }, 2 * 60 * 1000);

            await sendBookingAlert(order, user, state.data, 'AI Voice/Chat Bot');
            return;
        }
    }

    // AI Chat
    try {
        let { data: user } = await getUser(telegramId);
        if (!user) {
             const welcomeLang = ctx.from.language_code || 'ru';
             user = (await createUser({ telegram_id: telegramId, username: ctx.from.username || ctx.from.first_name, role: 'user', balance: 0, language_code: welcomeLang })).data;
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
            userLangCache[telegramId] = newLang;
            await supabase.from('users').update({ language_code: newLang }).eq('telegram_id', telegramId).catch(() => {});
        }

        const exMatch = aiResponse.match(/\[EXCURSION_ID:\s*([a-zA-Z0-9_-]+)\]/i);
        const intentMatch = aiResponse.match(/\[INTENT:\s*([a-z_]+)\]/i);
        const finalResponse = aiResponse.replace(/\[EXCURSION_ID:.*?\]/gi, '').replace(/\[BOOK_REQUEST:.*?\]/gi, '').replace(/\[LANG:.*?\]/gi, '').replace(/\[INTENT:.*?\]/gi, '').trim();

        if (exMatch && (excursions || []).find(e => e.id === exMatch[1].trim())) {
            const exId = exMatch[1].trim();
            lastShownExcursion[telegramId] = exId;
            const ex = excursions.find(e => e.id === exId);
            if (ex) await sendExcursionPhotos(telegramId, ex);
            if (intentMatch && intentMatch[1].toLowerCase() === 'sale') {
                await reply(ctx, finalResponse, { parse_mode: 'Markdown' });
                await startBookingStepper(ctx, telegramId, exId);
                await saveMessage(telegramId, 'assistant', finalResponse);
                return;
            }
        }

        await saveMessage(telegramId, 'assistant', finalResponse);
        // Special case for AI chat: we already have the localized text from AI, so we use ctx.reply directly
        try { await ctx.reply(finalResponse, { parse_mode: 'Markdown' }); } catch (e) { await ctx.reply(finalResponse); }
    } catch (e) { console.error('[AI Error]:', e.message); }
});

async function sendExcursionPhotos(telegramId, ex) {
    const photos = (ex.image_urls && Array.isArray(ex.image_urls)) ? ex.image_urls.filter(url => url && url.startsWith('http')) : (ex.image_url ? [ex.image_url] : []);
    if (photos.length === 0) return;
    try {
        if (photos.length === 1) await bot.telegram.sendPhoto(telegramId, photos[0]);
        else await bot.telegram.sendMediaGroup(telegramId, photos.slice(0, 10).map(url => ({ type: 'photo', media: url })));
    } catch (e) { console.warn('[MediaGroup] Error:', e.message); }
}

bot.launch().then(() => console.log('Bot running...'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
module.exports = bot;
