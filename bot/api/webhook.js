const bot = require('../index');

module.exports = async (request, response) => {
    try {
        // Убеждаемся, что запрос пришел от Телеграма
        if (request.method === 'POST') {
            await bot.handleUpdate(request.body);
        }
        response.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        response.status(500).send('Error');
    }
};
