const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { supabase, getUser, createUser, getExcursions, saveMessage, getHistory, createRequest, getFaq, clearHistory } = require('./src/supabase');
const { getChatResponse, getLocalizedText, getManagerReport } = require('./src/openai');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Кеш языков и состояний пользователей
const userLangCache = {};
const userStates = new Map(); // { telegramId: { step: 'name' | 'date' | 'hotel', excursionId: string, data: {} } }

bot.use(session());

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
            Markup.inlineKeyboard([])
        );

        // Уведомление клиенту
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

// --- CLIENT FLOW ---
bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    const startPayload = ctx.payload;

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

    const welcomeRu = `Привет, ${username}! 🌍\n\nЯ твой персональный гид. Помогу выбрать лучшую экскурсию и отвечу на любые вопросы.\n\nВ какую сторону смотрим? Напиши город или просто спроси, что у нас есть. 🗺️`;
    const welcomeText = await getLocalizedText(lang, welcomeRu);

    const webappBtnRu = '🎒 Открыть Каталог';
    const webappBtn = await getLocalizedText(lang, webappBtnRu);

    await ctx.reply(welcomeText,
        Markup.keyboard([
            [Markup.button.webApp(webappBtn, `${process.env.WEBAPP_URL || ''}?uid=${telegramId}`)]
        ]).resize()
    );
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const lang = userLangCache[telegramId] || 'ru';
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${telegramId}`;

    const texts = {
        ru: `🎁 Ваша реферальная ссылка:\n\n${refLink}\n\nПриглашайте друзей и получайте бонусы!`,
        tr: `🎁 Davet linkiniz:\n\n${refLink}\n\nArkadaşlarını davet et ve bonus kazan!`,
        en: `🎁 Your referral link:\n\n${refLink}\n\nInvite friends and get bonuses!`
    };
    const text = texts[lang] || texts.en;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    try {
        await ctx.replyWithPhoto(qrUrl, { caption: text });
    } catch (err) {
        await ctx.reply(text);
    }
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    const userText = ctx.message.text.trim();
    const state = userStates.get(telegramId);

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
            const msg = await getLocalizedText(lang, '🏨 Понял. И последний шаг: напишите ваш город и название отеля (или адрес, откуда вас забрать):');
            return ctx.reply(msg);
        }

        if (state.step === 'hotel') {
            state.data.hotelName = userText;
            const excursionId = state.excursionId;

            // Сохраняем заявку
            const { data: excursions } = await getExcursions();
            const selectedEx = excursions.find(e => e.id === excursionId);

            const { data: order } = await createRequest(
                telegramId,
                excursionId,
                selectedEx ? selectedEx.title : 'Экскурсия',
                state.data.fullName,
                state.data.tourDate,
                state.data.hotelName,
                selectedEx ? selectedEx.price_rub : 0
            );

            // === ВЫЗОВ МЕНЕДЖЕР-АГЕНТА ===
            const { data: user } = await getUser(telegramId);
            const { data: history } = await getHistory(telegramId, 10);

            const aiReport = await getManagerReport(user, history, selectedEx, state.data);

            userStates.delete(telegramId);

            const thanksRu = `✅ Спасибо! Ваша заявка отправлена оператору. Скоро мы свяжемся с вами для подтверждения деталей. 🙌`;
            const thanksMsg = await getLocalizedText(lang, thanksRu);
            await ctx.reply(thanksMsg);

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
                                ]
                            ])
                        });
                    } catch (e) {
                        // Фолбэк если Markdown в отчете AI сломался
                        await bot.telegram.sendMessage(m.telegram_id, aiReport.replace(/[\*_`\[\]()]/g, ''), {
                            ...Markup.inlineKeyboard([
                                [
                                    Markup.button.callback('✅ Принять', `accept_req_${order.id}`),
                                    Markup.button.callback('❌ Отклонить', `cancel_req_${order.id}`)
                                ]
                            ])
                        });
                    }
                }
            }
            return;
        }
    }

    // --- AI ЧАТ ---
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

    const { data: history } = await getHistory(telegramId);
    const { data: excursions } = await getExcursions();
    const { data: faqRows } = await getFaq();

    const faqText = faqRows ? faqRows.map(f => `- ${f.topic}: ${f.content_ru}`).join('\n') : '';

    await saveMessage(telegramId, 'user', userText);
    try { await ctx.sendChatAction('typing'); } catch (e) { }

    const aiResponse = await getChatResponse(excursions, faqText, history, userText);

    // Парсим теги
    const langMatch = aiResponse.match(/\[LANG:\s*(ru|tr|en)\]/i);
    if (langMatch) userLangCache[telegramId] = langMatch[1].toLowerCase();

    const bookMatch = aiResponse.match(/\[BOOK_REQUEST:\s*([a-zA-Z0-9_-]+)\]/i);
    let finalResponse = aiResponse.replace(/\[BOOK_REQUEST:.*?\]/gi, '').replace(/\[LANG:.*?\]/gi, '').trim();

    if (bookMatch) {
        const excursionId = bookMatch[1];
        const selectedEx = excursions.find(e => e.id === excursionId);

        if (selectedEx) {
            // Начинаем сбор данных
            userStates.set(telegramId, { step: 'name', excursionId, data: {} });

            const currentLang = userLangCache[telegramId] || 'ru';
            const namePromptRu = `Прекрасный выбор! 😍 Чтобы оформить заявку на экскурсию «${selectedEx.title}», мне нужно уточнить пару деталей.\n\n👤 Как к вам можно обращаться? Напишите, пожалуйста, ваше ФИО.`;
            const namePrompt = await getLocalizedText(currentLang, namePromptRu);

            await saveMessage(telegramId, 'assistant', finalResponse);
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
            return ctx.reply(namePrompt);
        }
    }

    await saveMessage(telegramId, 'assistant', finalResponse);
    await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
});

// Запуск
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    bot.launch().then(() => console.log('Excursion Bot with AI Multi-Agents is running...'));
}

module.exports = bot;
