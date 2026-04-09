const axios = require('axios');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const { ANALYZER_PROMPT, WRITER_PROMPT, LOCALIZER_PROMPT, MANAGER_ALERTER_PROMPT } = require('./prompts');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim(),
    timeout: 60000,
    defaultHeaders: {
        'HTTP-Referer': 'https://excursion-bot.com',
        'X-Title': 'Excursion Bot',
    }
});

module.exports = {
    async getChatResponse(excursions, faqText, history, userMessage) {
        try {
            // === AGENT 1: THE ANALYZER (Analyst) ===
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

            const rawJsonStr = analyzerResponse.choices?.[0]?.message?.content || '';
            console.log("Analyzer Output:", rawJsonStr);

            let analysis = { lang_code: 'ru', intent: 'consultation', excursion_id: null, writer_instruction: 'Уточни, что интересует клиента.' };

            if (rawJsonStr) {
                try {
                    const cleanJsonStr = rawJsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJsonStr);
                    if (parsed) {
                        analysis = { ...analysis, ...parsed };
                    }
                } catch (e) {
                    console.error("JSON Parse Error:", e.message, "Raw:", rawJsonStr.slice(0, 200));
                }
            }

            // === AGENT 2: THE WRITER (Manager) ===
            const writerMessages = [
                { role: 'system', content: WRITER_PROMPT(excursions, faqText) },
                { role: 'user', content: `Инструкции Аналитика:\nЯзык: ${analysis.lang_code}\nНамерение: ${analysis.intent}\nИнструкция: ${analysis.writer_instruction}` }
            ];

            const writerResponse = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: writerMessages,
                temperature: 0.7,
            });

            const russianMessage = writerResponse.choices[0].message.content;

            // === AGENT 3: THE TRANSLATOR (Localizer) ===
            let finalMessage = russianMessage;
            if (analysis.lang_code && analysis.lang_code !== 'ru') {
                finalMessage = await this.getLocalizedText(analysis.lang_code, russianMessage);
            }

            // Embedded tags for index.js
            let embeddedTags = `[LANG:${analysis.lang_code || 'ru'}] [INTENT:${analysis.intent || 'consultation'}]`;
            if (analysis.excursion_id) {
                embeddedTags += `\n[EXCURSION_ID: ${analysis.excursion_id}]`;
            }

            return finalMessage + '\n' + embeddedTags;

        } catch (error) {
            console.error('[OpenAI Fatal Error]:', error.message);
            if (error.response) {
                console.error('[OpenAI Status]:', error.response.status);
                console.error('[OpenAI Data]:', error.response.data);
            }
            return 'Извини, произошла ошибка. Попробуй чуть позже. 🙏';
        }
    },

    // === AGENT 4: THE MANAGER ALERTER ===
    async getManagerReport(userData, history, excursion, bookingDetails, origin = 'AI Chat', managerLang = 'ru') {
        try {
            const context = `
Источник: ${origin}
Клиент: @${userData.username || 'unknown'} (ID: ${userData.telegram_id})
История: ${history.slice(-5).map(h => `${h.role === 'user' ? 'Клиент' : 'Бот'}: ${h.content}`).join('\n')}
Экскурсия: ${excursion ? excursion.title : 'Не выбрана'}
Данные:
- ФИО: ${bookingDetails.fullName || '—'}
- Дата: ${bookingDetails.tourDate || '—'}
- Место: ${bookingDetails.hotelName || '—'}
- WhatsApp: ${bookingDetails.phone || '—'}
`;

            const response = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: MANAGER_ALERTER_PROMPT(managerLang) },
                    { role: 'user', content: context }
                ],
                temperature: 0.5
            });

            return response.choices[0].message.content;
        } catch (e) {
            return `🚀 **НОВАЯ ЗАЯВКА (${origin})!**\n\n📌 **Тур:** ${excursion?.title || 'Не выбрана'}\n👤 **Клиент:** @${userData.username || userData.telegram_id}\n📞 **WhatsApp:** ${bookingDetails.phone || '—'}\n\n⚠️ _Ошибка ИИ анализа, проверьте детали вручную._`;
        }
    },

    async getLocalizedText(langCode, russianText, retries = 1) {
        if (!langCode || langCode === 'ru') return russianText;

        // Try OpenAI Localizer first
        const attempt = async () => {
            const res = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: LOCALIZER_PROMPT },
                    { role: 'user', content: `Target Language: ${langCode}\nText:\n${russianText}` }
                ],
                temperature: 0.2,
                max_tokens: 1000
            });
            return res.choices[0].message.content.trim();
        };

        for (let i = 0; i <= retries; i++) {
            try {
                return await attempt();
            } catch (e) {
                console.warn(`[Localizer] AI attempt ${i+1} failed: ${e.message}`);
                if (i === retries) {
                    // FINAL FALLBACK: MyMemory (Free API)
                    try {
                        console.log(`[Localizer] Falling back to MyMemory for ${langCode}`);
                        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(russianText.slice(0, 500))}&langpair=ru|${langCode}`;
                        const res = await axios.get(url, { timeout: 5000 });
                        return res.data?.responseData?.translatedText || russianText;
                    } catch (err) {
                        return russianText;
                    }
                }
            }
        }
        return russianText;
    }
};
