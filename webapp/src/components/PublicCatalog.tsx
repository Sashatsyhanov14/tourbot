import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Excursion {
    id: string;
    city: string;
    title: string;
    description: string;
    price_rub: number;
    duration: string;
    included?: string;
    meeting_point?: string;
    image_url: string;
    image_urls: string[];
    // Multilingual
    title_en?: string;
    title_tr?: string;
    city_en?: string;
    city_tr?: string;
    description_en?: string;
    description_tr?: string;
    duration_en?: string;
    duration_tr?: string;
    included_en?: string;
    included_tr?: string;
    meeting_point_en?: string;
    meeting_point_tr?: string;
    city_de?: string; title_de?: string; description_de?: string; duration_de?: string; included_de?: string; meeting_point_de?: string;
    city_pl?: string; title_pl?: string; description_pl?: string; duration_pl?: string; included_pl?: string; meeting_point_pl?: string;
    city_ar?: string; title_ar?: string; description_ar?: string; duration_ar?: string; included_ar?: string; meeting_point_ar?: string;
    city_fa?: string; title_fa?: string; description_fa?: string; duration_fa?: string; included_fa?: string; meeting_point_fa?: string;
}

export default function PublicCatalog({ t, lang, initialExcursionId }: { t: any, lang: string, initialExcursionId?: string | null }) {
    const [excursions, setExcursions] = useState<Excursion[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [bookingEx, setBookingEx] = useState<Excursion | null>(null);
    const [selectedEx, setSelectedEx] = useState<Excursion | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', date: '' });

    const tg = window.Telegram?.WebApp;

    useEffect(() => {
        fetchExcursions();
    }, []);

    useEffect(() => {
        if (initialExcursionId && excursions.length > 0) {
            const ex = excursions.find(e => e.id === initialExcursionId);
            if (ex) {
                setBookingEx(ex);
            }
        }
    }, [initialExcursionId, excursions]);

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
            fullName: formData.name,
            phone: formData.phone,
            tourDate: formData.date
        };

        tg?.sendData(JSON.stringify(bookingData));
        setTimeout(() => tg?.close(), 100);
        
        setBookingEx(null);
    };

    const filtered = excursions.filter(ex => {
        const title = (lang === 'ru' ? ex.title : (ex as any)[`title_${lang}`]) || ex.title;
        const city = (lang === 'ru' ? ex.city : (ex as any)[`city_${lang}`]) || ex.city;
        return title.toLowerCase().includes(search.toLowerCase()) || city.toLowerCase().includes(search.toLowerCase());
    });

    if (loading) return <div className="text-center p-10 animate-pulse text-slate-400">Загрузка каталога...</div>;

    const renderExcursion = (ex: Excursion) => {
        const title = (lang === 'ru' ? ex.title : (ex as any)[`title_${lang}`]) || ex.title;
        const city = (lang === 'ru' ? ex.city : (ex as any)[`city_${lang}`]) || ex.city;
        const desc = (lang === 'ru' ? ex.description : (ex as any)[`description_${lang}`]) || ex.description;
        const duration = (lang === 'ru' ? ex.duration : (ex as any)[`duration_${lang}`]) || ex.duration;
        const included = (lang === 'ru' ? ex.included : (ex as any)[`included_${lang}`]) || ex.included;
        const meeting = (lang === 'ru' ? ex.meeting_point : (ex as any)[`meeting_point_${lang}`]) || ex.meeting_point;

        return { title, city, desc, duration, included, meeting };
    };

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
                {filtered.map(ex => {
                    const info = renderExcursion(ex);
                    return (
                        <div key={ex.id} 
                             onClick={() => setSelectedEx(ex)}
                             className="bg-[#1a1a1d] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl group active:scale-[0.98] transition-all cursor-pointer">
                            <div className="relative aspect-[16/10] overflow-hidden">
                                <img 
                                    src={ex.image_url || (ex.image_urls?.[0]) || 'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&q=80&w=800'} 
                                    alt={info.title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                    <p className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] text-primary">location_on</span>
                                        {info.city}
                                    </p>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="text-xl font-black text-white mb-2 leading-tight">{info.title}</h3>
                                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{info.desc}</p>
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
                                            {info.duration || (lang === 'ru' ? '4 часа' : '4 hours')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail Modal */}
            {selectedEx && (() => {
                const info = renderExcursion(selectedEx);
                return (
                    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f0f11] animate-in slide-in-from-bottom-6 duration-300 overflow-y-auto">
                        {/* Hero Image / Gallery */}
                        <div className="relative w-full aspect-[4/3] bg-black">
                            <div className="absolute top-4 left-4 z-10">
                                <button 
                                    onClick={() => setSelectedEx(null)}
                                    className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            
                            <div className="flex h-full overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                               {[selectedEx.image_url, ...(selectedEx.image_urls || [])].filter(Boolean).map((url, i) => (
                                   <div key={i} className="min-w-full h-full snap-center">
                                       <img src={url} className="w-full h-full object-cover" alt="" />
                                   </div>
                               ))}
                            </div>
                            
                            <div className="absolute bottom-6 left-6 right-6 text-left">
                                <div className="bg-black/30 backdrop-blur-md px-4 py-1 bottom-4 left-4 rounded-full w-fit border border-white/10">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{info.city}</p>
                                </div>
                                <h2 className="text-3xl font-black text-white mt-2 leading-tight drop-shadow-lg">{info.title}</h2>
                            </div>
                        </div>

                        <div className="p-6 space-y-8 flex-1">
                            {/* Stats Row */}
                            <div className="flex gap-4">
                                <div className="flex-1 bg-[#1a1a1d] p-4 rounded-2xl border border-white/5 space-y-1">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ru' ? 'Стоимость' : 'Price'}</p>
                                    <p className="text-xl font-black text-primary">${selectedEx.price_rub}</p>
                                </div>
                                <div className="flex-1 bg-[#1a1a1d] p-4 rounded-2xl border border-white/5 space-y-1">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ru' ? 'Длительность' : 'Duration'}</p>
                                    <p className="text-base font-bold text-white">{info.duration || '—'}</p>
                                </div>
                            </div>

                            {/* Full Description */}
                            <div className="space-y-3">
                                <h4 className="text-lg font-black text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">notes</span>
                                    {lang === 'ru' ? 'Описание' : 'Description'}
                                </h4>
                                <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">{info.desc}</p>
                            </div>

                            {/* Included Section */}
                            {info.included && (
                                <div className="space-y-3">
                                    <h4 className="text-lg font-black text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">check_circle</span>
                                        {lang === 'ru' ? 'Что включено' : 'Included'}
                                    </h4>
                                    <p className="text-slate-400 text-sm italic border-l-2 border-primary/30 pl-4">{info.included}</p>
                                </div>
                            )}

                            {/* Meeting Point */}
                            {info.meeting && (
                                <div className="space-y-3">
                                    <h4 className="text-lg font-black text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">near_me</span>
                                        {lang === 'ru' ? 'Место встречи' : 'Meeting Point'}
                                    </h4>
                                    <p className="text-slate-400 text-sm text-left">{info.meeting}</p>
                                </div>
                            )}

                            {/* Floating Booking Button */}
                            <div className="sticky bottom-0 pt-4 pb-8 bg-gradient-to-t from-[#0f0f11] to-transparent">
                                <button
                                    onClick={() => setBookingEx(selectedEx)}
                                    className="w-full bg-primary text-on-primary py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-[0_12px_30px_rgba(208,188,255,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <span className="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
                                    {lang === 'ru' ? 'Забронировать сейчас' : 'Book Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Booking Modal (Order Form) */}
            {bookingEx && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-left">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setBookingEx(null)} />
                    <div className="relative w-full max-w-sm bg-[#1a1a1d] rounded-[32px] border border-white/10 p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-2">
                            <h4 className="text-xl font-black text-white">{lang === 'ru' ? 'Быстрое бронирование' : 'Quick Booking'}</h4>
                            <p className="text-xs text-slate-400 px-4">{lang === 'ru' ? 'Оставьте ваши контакты, и наш менеджер сразу свяжется с вами для подтверждения.' : 'Leave your contacts, and our manager will contact you immediately for confirmation.'}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">{lang === 'ru' ? 'Ваше имя' : 'Your Name'}</label>
                                <input
                                    type="text"
                                    placeholder={lang === 'ru' ? 'Иван Иванов' : 'John Doe'}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">{lang === 'ru' ? 'Телефон (WhatsApp)' : 'Phone (WhatsApp)'}</label>
                                <input
                                    type="tel"
                                    placeholder="+7 (999) 000-00-00"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">{lang === 'ru' ? 'Желаемая дата' : 'Desired Date'}</label>
                                <input
                                    type="text"
                                    placeholder={lang === 'ru' ? '25 мая или "Завтра"' : 'May 25 or "Tomorrow"'}
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
                                {lang === 'ru' ? 'Отправить' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
