const express = require('express');
const cors = require('cors');
const path = require('path');
const bot = require('./index');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
const webappDistPath = path.join(__dirname, '../webapp/dist');
app.use(express.static(webappDistPath));

// Webhook endpoint (if using webhooks)
app.post('/api/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Error');
    }
});

// API endpoint to send QR code via bot
app.post('/api/send-qr', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        if (!telegram_id) return res.status(400).json({ error: 'Missing telegram_id' });

        const refLink = `https://t.me/emedeoesimworld_bot?start=${telegram_id}`;

        const caption = `🔗 Link: ${refLink}\n🎁 Promo: ${telegram_id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}`;
        await bot.telegram.sendPhoto(telegram_id, qrUrl, { caption });

        res.json({ success: true });
    } catch (err) {
        console.error('API Send QR Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Any other request serves the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(webappDistPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Check if we should use Long Polling or Webhook
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    if (WEBHOOK_URL) {
        bot.telegram.setWebhook(`${WEBHOOK_URL}/api/webhook`)
            .then(() => console.log(`Webhook set to: ${WEBHOOK_URL}/api/webhook`))
            .catch(err => console.error('Error setting webhook:', err));
    } else {
        bot.launch()
            .then(() => console.log('Bot started with Long Polling'))
            .catch(err => console.error('Error launching bot:', err));
    }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
