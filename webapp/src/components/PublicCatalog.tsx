import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Excursion {
    id: string;
    city: string;
    title: string;
    description: string;
    price_rub: number;
    duration: string;
    image_url: string;
    image_urls: string[];
}

export default function PublicCatalog({ t, lang }: { t: any, lang: string }) {
    const [excursions, setExcursions] = useState<Excursion[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [bookingEx, setBookingEx] = useState<Excursion | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', date: '' });

    const tg = window.Telegram?.WebApp;

    useEffect(() => {
        fetchExcursions();
    }, []);

    const fetchExcursions = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('excursions')
            .select('*')
            .eq('is_active', true)
            .order('sort_number', { ascending: true });
        if (data) setExcursions(data);
        setLoading(false);
    };

    const handleBook = () => {
        if (!formData.name || !formData.phone || !formData.date || !bookingEx) {
            tg?.showAlert('Пожалуйста, заполните все поля');
            return;
        }

        const bookingData = {
            type: 'quick_book',
            excursionId: bookingEx.id,
            excursionTitle: bookingEx.title,
            priceRub: bookingEx.price_rub,
            fullName: formData.name,
            phone: formData.phone,
            tourDate: formData.date
        };

        tg?.showAlert(`Отправка данных: ${bookingEx.title}`);
        tg?.sendData(JSON.stringify(bookingData));
        setBookingEx(null);
    };

    const filtered = excursions.filter(ex => 
        ex.city.toLowerCase().includes(search.toLowerCase()) || 
        ex.title.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="text-center p-10 animate-pulse text-slate-400">Загрузка каталога...</div>;

    return (
        <div className="space-y-6 pb-10">
            {/* Search Bar */}
            <div className="sticky top-0 z-20 bg-[#0f0f11]/80 backdrop-blur-md pt-2 pb-4 px-1">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">search</span>
                    <input
                        type="text"
                        placeholder={lang === 'ru' ? 'Поиск по городу или названию...' : 'Search by city or title...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-[#1a1a1d] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-primary/50 outline-none transition-all placeholder:text-slate-600 shadow-xl"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6">
                {filtered.map(ex => (
                    <div key={ex.id} className="bg-[#1a1a1d] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl group active:scale-[0.98] transition-transform">
                        <div className="relative aspect-[16/10] overflow-hidden">
                            <img 
                                src={ex.image_url || (ex.image_urls?.[0]) || 'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&q=80&w=800'} 
                                alt={ex.title} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                <p className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                                    {ex.city}
                                </p>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <h3 className="text-xl font-black text-white mb-2 leading-tight">{ex.title}</h3>
                                <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{ex.description}</p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lang === 'ru' ? 'Стоимость' : 'Price'}</p>
                                    <p className="text-2xl font-black text-primary">${ex.price_rub}</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{lang === 'ru' ? 'Длительность' : 'Duration'}</p>
                                    <p className="text-base font-bold text-white flex items-center justify-end gap-1.5">
                                        <span className="material-symbols-outlined text-[18px] text-primary/70">schedule</span>
                                        {ex.duration || (lang === 'ru' ? '4 часа' : '4 hours')}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setBookingEx(ex)}
                                className="w-full bg-primary text-on-primary py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_8px_25px_rgba(208,188,255,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                                {lang === 'ru' ? 'Забронировать' : 'Book Now'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Booking Modal */}
            {bookingEx && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setBookingEx(null)} />
                    <div className="relative w-full max-w-sm bg-[#1a1a1d] rounded-[32px] border border-white/10 p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-2">
                            <h4 className="text-xl font-black text-white">Быстрое бронирование</h4>
                            <p className="text-xs text-slate-400 px-4">Оставьте ваши контакты, и наш менеджер сразу свяжется с вами для подтверждения.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Ваше имя</label>
                                <input
                                    type="text"
                                    placeholder="Иван Иванов"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Телефон (WhatsApp)</label>
                                <input
                                    type="tel"
                                    placeholder="+7 (999) 000-00-00"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Желаемая дата</label>
                                <input
                                    type="text"
                                    placeholder="25 мая или 'Завтра'"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setBookingEx(null)}
                                className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
                            >
                                {t.cancelBtn}
                            </button>
                            <button
                                onClick={handleBook}
                                className="flex-1 py-4 bg-primary text-on-primary rounded-2xl text-xs font-black uppercase tracking-widest shadow-[0_8px_25px_rgba(208,188,255,0.2)] active:scale-95 transition-all"
                            >
                                Отправить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
