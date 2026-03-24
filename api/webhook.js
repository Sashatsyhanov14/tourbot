const bot = require('../bot/index');

module.exports = async (request, response) => {
    try {
        if (request.method === 'POST') {
            await bot.handleUpdate(request.body);
        }
        response.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        response.status(500).send('Error');
    }
};
