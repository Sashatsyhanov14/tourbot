const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');

const envPath = path.resolve(__dirname, './.env');
console.log('Checking .env at:', envPath);
dotenv.config({ path: envPath });

console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ Found' : '❌ Missing');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✅ Found' : '❌ Missing');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Found' : '❌ Missing');

const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('CRITICAL: No API Key found!');
    process.exit(1);
}

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey
});

async function testAI() {
    try {
        console.log('Testing OpenRouter connection...');
        const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: 'hi' }],
        });
        console.log('AI Response:', response.choices[0].message.content);
        console.log('✅ OpenRouter Connection: SUCCESS');
    } catch (e) {
        console.error('❌ OpenRouter Error:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', e.response.data);
        }
    }
}

testAI();
