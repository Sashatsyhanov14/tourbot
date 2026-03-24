const OpenAI = require('openai');
const dotenv = require('dotenv');
const { ANALYZER_PROMPT, WRITER_PROMPT, LOCALIZER_PROMPT, MANAGER_ALERTER_PROMPT } = require('./prompts');

dotenv.config();

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://excursion-bot.com',
        'X-Title': 'Excursion Bot',
    }
});

module.exports = {
    async getChatResponse(excursions, faqText, history, userMessage) {
        try {
            // === АГЕНТ 1: АНАЛИТИК (Analyzer) ===
            const analyzerMessages = [
                { role: 'system', content: ANALYZER_PROMPT(excursions) },
                ...history,
                { role: 'user', content: userMessage }
            ];

            const analyzerResponse = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: analyzerMessages,
                temperature: 0.1
            });

            const rawJsonStr = analyzerResponse.choices[0].message.content;
            let analysis;
            try {
                const cleanJsonStr = rawJsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
                analysis = JSON.parse(cleanJsonStr);
            } catch (e) {
                analysis = { lang_code: 'ru', intent: 'consultation', excursion_id: null, writer_instruction: 'Ответь кратко на запрос.' };
            }

            // === АГЕНТ 2: ПИСАТЕЛЬ (Writer) — Всегда на RU ===
            const writerMessages = [
                { role: 'system', content: WRITER_PROMPT(excursions, faqText) },
                {
                    role: 'user',
                    content: `Инструкции от Аналитика:\nНамерение клиента: ${analysis.intent}\nЧто сказать клиенту:\n${analysis.writer_instruction}`
                }
            ];

            const writerResponse = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: writerMessages,
                temperature: 0.7,
            });

            const russianMessage = writerResponse.choices[0].message.content;

            // === АГЕНТ 3: ПЕРЕВОДЧИК (Translator) ===
            // Переводим только если язык не русский
            let finalMessage = russianMessage;
            if (analysis.lang_code !== 'ru') {
                const translatorResponse = await openai.chat.completions.create({
                    model: 'openai/gpt-4o-mini',
                    messages: [
                        { role: 'system', content: LOCALIZER_PROMPT },
                        { role: 'user', content: `Целевой язык: ${analysis.lang_code}\nТекст:\n${russianMessage}` }
                    ],
                    temperature: 0.2
                });
                finalMessage = translatorResponse.choices[0].message.content.trim();
            }

            // Прикрепляем теги для парсера в index.js
            let embeddedTags = `[LANG:${analysis.lang_code}]`;
            if (analysis.intent === 'sale' && analysis.excursion_id) {
                embeddedTags += `\n[BOOK_REQUEST: ${analysis.excursion_id}]`;
            }

            return finalMessage + '\n' + embeddedTags;

        } catch (error) {
            console.error('[OpenAI Error]:', error);
            return 'Извини, произошла ошибка. Попробуй чуть позже. 🙏';
        }
    },

    // === АГЕНТ 4: МЕНЕДЖЕР-АНАЛИТИК (Manager Alerter) ===
    async getManagerReport(userData, history, excursion, bookingDetails) {
        try {
            const context = `
Данные клиента: @${userData.username || 'unknown'} (ID: ${userData.telegram_id})
История переписки (последние 5 сообщений):
${history.slice(-5).map(h => `${h.role === 'user' ? 'Клиент' : 'Бот'}: ${h.content}`).join('\n')}

Выбранная экскурсия: ${excursion ? excursion.title : 'Не выбрана'}
Собранные данные для брони:
- ФИО: ${bookingDetails.fullName || '—'}
- Дата: ${bookingDetails.tourDate || '—'}
- Отель/Адрес: ${bookingDetails.hotelName || '—'}
`;

            const response = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: MANAGER_ALERTER_PROMPT },
                    { role: 'user', content: context }
                ],
                temperature: 0.5
            });

            return response.choices[0].message.content;
        } catch (e) {
            console.error('[Manager Alerter Error]:', e.message);
            // Фолбэк на стандартное сообщение, если AI упал
            return `🚀 **НОВАЯ ЗАЯВКА!**\n\n📌 ${excursion?.title}\n👤 Клиент: @${userData.username}\n📝 ФИО: ${bookingDetails.fullName}\n📅 Дата: ${bookingDetails.tourDate}\n🏨 Отель: ${bookingDetails.hotelName}`;
        }
    },

    async getLocalizedText(langCode, russianText) {
        if (!langCode || langCode === 'ru') return russianText;
        try {
            const response = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: LOCALIZER_PROMPT },
                    { role: 'user', content: `Целевой язык: ${langCode}\nТекст:\n${russianText}` }
                ],
                temperature: 0.2,
            });
            return response.choices[0].message.content.trim();
        } catch (e) {
            return russianText;
        }
    }
};
