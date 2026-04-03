const dotenv = require('dotenv');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const { createClient } = require('@supabase/supabase-js');
const { getLocalizedText } = require('../src/openai');

console.log(`[CONFIG] Environment loaded from: ${envPath}`);
if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENROUTER_API_KEY not found in bot/.env');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL || '', 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
);

async function translateAll() {
    console.log('🚀 Starting AI Translation for Excursions...');

    const { data: excursions, error } = await supabase
        .from('excursions')
        .select('*');

    if (error) {
        console.error('❌ Error fetching excursions:', error.message);
        return;
    }

    console.log(`📦 Found ${excursions.length} excursions. Checking translations...`);

    for (const ex of excursions) {
        const updates = {};
        const languages = ['en', 'tr', 'de', 'pl', 'ar', 'fa'];

        for (const lang of languages) {
            // Fields to translate
            const fields = ['title', 'city', 'description', 'duration', 'included', 'meeting_point'];
            
            for (const field of fields) {
                const targetKey = `${field}_${lang}`;
                // Only translate if target is empty and source (Russian) exists
                if (!ex[targetKey] && ex[field]) {
                    console.log(`🌐 [${lang.toUpperCase()}] Translating [${ex.title}] ${field}...`);
                    try {
                        const translation = await getLocalizedText(lang, ex[field]);
                        if (translation && translation !== ex[field]) {
                            updates[targetKey] = translation;
                        }
                    } catch (e) {
                        console.error(`⚠️ Failed to translate ${field} for ${ex.id}:`, e.message);
                    }
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase
                .from('excursions')
                .update(updates)
                .eq('id', ex.id);
            
            if (upErr) {
                console.error(`❌ Error updating ${ex.title}:`, upErr.message);
            } else {
                console.log(`✅ Updated ${ex.title} with ${Object.keys(updates).length} new translations.`);
            }
        } else {
            console.log(`⏭️ ${ex.title} already translated.`);
        }
    }

    console.log('✨ All translations completed!');
}

translateAll();
