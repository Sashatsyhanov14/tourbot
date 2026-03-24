const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    const { telegram_id, lang } = req.body;
    if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const refLink = `https://t.me/eesimtestbot?start=${telegram_id}`;
    const uiLang = lang === 'ru' ? 'ru' : (lang === 'tr' ? 'tr' : 'en');

    const texts = {
        ru: `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegram_id}\``,
        tr: `🎁 İşte davet linkiniz ve QR kodunuz:\n\n${refLink}\n\nPromosyon kodunuz (linki açamayanlar için): \`${telegram_id}\``,
        en: `🎁 Here is your invitation link and QR code:\n\n${refLink}\n\nYour promo code (for manual entry): \`${telegram_id}\``
    };
    const text = texts[uiLang];
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    try {
        const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegram_id,
                photo: qrUrl,
                caption: text,
                parse_mode: 'Markdown'
            })
        });
        const result = await resp.json();
        if (result.ok) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(500).json({ error: result.description });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
