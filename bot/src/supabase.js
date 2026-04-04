const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const crypto = require('crypto');

module.exports = {
  supabase,

  async getUser(telegramId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    return { data, error };
  },

  async createUser(user) {
    user.created_at = new Date().toISOString();
    if (user.balance === undefined) user.balance = 0;

    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select()
      .single();

    if (error) console.error('Supabase createUser error:', error.message);
    return { data, error };
  },

  async getExcursions() {
    const { data, error } = await supabase
      .from('excursions')
      .select(`
        id, sort_number, city, title, description, price_rub, duration, included, meeting_point, image_url, image_urls, is_active,
        city_en, city_tr, city_de, city_pl, city_ar, city_fa,
        title_en, title_tr, title_de, title_pl, title_ar, title_fa,
        description_en, description_tr, description_de, description_pl, description_ar, description_fa,
        duration_en, duration_tr, duration_de, duration_pl, duration_ar, duration_fa,
        included_en, included_tr, included_de, included_pl, included_ar, included_fa,
        meeting_point_en, meeting_point_tr, meeting_point_de, meeting_point_pl, meeting_point_ar, meeting_point_fa
      `)
      .eq('is_active', true)
      .order('sort_number', { ascending: true });
    return { data, error };
  },

  async saveMessage(userId, role, content) {
    const { error } = await supabase
      .from('chat_history')
      .insert([{ id: crypto.randomUUID(), user_id: userId, role, content, created_at: new Date().toISOString() }]);
    if (error) console.error('Supabase saveMessage error:', error.message);
    return { error };
  },

  async clearHistory(userId) {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', userId);
    return { error };
  },

  async getHistory(userId, limit = 10) {
    const { data, error } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: (data || []).reverse(), error };
  },

  async getFaq() {
    const { data, error } = await supabase.from('faq').select('*');
    return { data, error };
  },

  async createRequest(userId, excursionId, excursionTitle, fullName, tourDate, hotelName, priceRub, phone) {
    const reqId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('requests')
      .insert([{
        id: reqId,
        user_id: userId,
        excursion_id: excursionId,
        excursion_title: excursionTitle,
        full_name: fullName,
        tour_date: tourDate,
        hotel_name: hotelName,
        price_rub: priceRub,
        phone: phone || null,
        status: 'new',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) console.error('Supabase createRequest error:', error.message);
    return { data, error };
  }
};
