const dotenv = require('dotenv');
dotenv.config();

console.log('--- DEBUG START ---');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'EXISTS' : 'MISSING');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'EXISTS' : 'MISSING');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'EXISTS' : 'MISSING');
console.log('--- TESTING MODULES ---');

try {
    const { Telegraf } = require('telegraf');
    console.log('Telegraf: LOADED');
    const bot = new Telegraf(process.env.BOT_TOKEN || 'test');
    console.log('Telegraf Instance: CREATED');
} catch (e) {
    console.error('Telegraf Error:', e.message);
}

try {
    const { createClient } = require('@supabase/supabase-js');
    console.log('Supabase SDK: LOADED');
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log('Supabase Client: CREATED');
    }
} catch (e) {
    console.error('Supabase Error:', e.message);
}

console.log('--- DEBUG END ---');
