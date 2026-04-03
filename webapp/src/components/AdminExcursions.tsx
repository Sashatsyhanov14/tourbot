import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_FORM = {
    city: '', title: '', description: '', price_rub: 0,
    duration: '', included: '', meeting_point: '',
    city_en: '', title_en: '', description_en: '', duration_en: '', included_en: '', meeting_point_en: '',
    city_tr: '', title_tr: '', description_tr: '', duration_tr: '', included_tr: '', meeting_point_tr: '',
    city_de: '', title_de: '', description_de: '', duration_de: '', included_de: '', meeting_point_de: '',
    city_pl: '', title_pl: '', description_pl: '', duration_pl: '', included_pl: '', meeting_point_pl: '',
    city_ar: '', title_ar: '', description_ar: '', duration_ar: '', included_ar: '', meeting_point_ar: '',
    city_fa: '', title_fa: '', description_fa: '', duration_fa: '', included_fa: '', meeting_point_fa: '',
    image_url: '', image_urls: [] as string[],
    sort_number: 1, is_active: true
};

const ConfirmDialog: React.FC<{
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ message, confirmLabel = 'Удалить', onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-28 px-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
        <div className="w-full max-w-sm bg-[#1a1a1d] rounded-3xl border border-white/10 p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-red-400 text-[24px]">delete_forever</span>
                </div>
                <p className="text-sm text-slate-200 font-semibold leading-snug">{message}</p>
                <p className="text-xs text-slate-500">Это действие нельзя отменить</p>
            </div>
            <div className="flex gap-2 pt-2">
                <button onClick={onCancel} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-slate-300">Отмена</button>
                <button onClick={onConfirm} className="flex-1 py-3 bg-red-500/20 border border-red-500/30 rounded-2xl text-sm font-black text-red-400">{confirmLabel}</button>
            </div>
        </div>
    </div>
);

export default function AdminExcursions({ t }: { t: any }) {
    const [excursions, setExcursions] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState<any>({ ...EMPTY_FORM });
    const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);
    const [photoToRemove, setPhotoToRemove] = useState<number | null>(null);
    const [activeLang, setActiveLang] = useState<'ru' | 'en' | 'tr' | 'de' | 'pl' | 'ar' | 'fa'>('ru');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchExcursions(); }, []);

    const fetchExcursions = async () => {
        setLoading(true);
        const { data } = await supabase.from('excursions').select('*').order('sort_number', { ascending: true });
        setExcursions(data || []);
        setLoading(false);
    };

    const handleFilesSelect = async (files: FileList) => {
        setUploading(true);
        const newUrls: string[] = [];
        try {
            for (const file of Array.from(files)) {
                const ext = file.name.split('.').pop();
                const fileName = `excursion_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const { error } = await supabase.storage.from('excursion_photos').upload(fileName, file, { upsert: true, contentType: file.type });
                if (error) throw error;
                const { data: urlData } = supabase.storage.from('excursion_photos').getPublicUrl(fileName);
                newUrls.push(urlData.publicUrl);
            }
            setFormData((prev: any) => ({
                ...prev,
                image_urls: [...(prev.image_urls || []), ...newUrls],
                image_url: prev.image_url || newUrls[0] || ''
            }));
        } catch (e: any) {
            alert('Ошибка загрузки: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        const { error } = isEditing 
            ? await supabase.from('excursions').update(formData).eq('id', isEditing.id)
            : await supabase.from('excursions').insert([formData]);
        
        if (error) {
            alert('Ошибка при сохранении: ' + error.message);
            return;
        }
        setIsEditing(null);
        setFormData({ ...EMPTY_FORM });
        fetchExcursions();
    };

    const startEdit = (ex: any) => {
        setIsEditing(ex);
        setFormData({ ...EMPTY_FORM, ...ex, image_urls: ex.image_urls || [] });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAutoTranslate = () => {
        const tg = (window as any).Telegram?.WebApp;
        if (!formData.title || !formData.description) {
            tg?.showAlert('Сначала заполните Название и Описание на Русском!');
            return;
        }
        tg?.showConfirm('Бот автоматически переведет данные на все языки (En, Tr, De, Pl, Ar, Fa) через ИИ. Продолжить?', (ok: boolean) => {
            if (ok) {
                tg.sendData(JSON.stringify({ 
                    type: 'auto_translate_excursion', 
                    excursionId: isEditing?.id || 'new',
                    data: formData 
                }));
                tg.showAlert('Запрос отправлен! Бот пришлет перевод в чат или обновит базу. Не забудьте обновить страницу позже.');
            }
        });
    };

    if (loading) return <div className="text-center py-10 opacity-50 animate-pulse text-white">Загрузка...</div>;

    const photos: string[] = formData.image_urls || [];

    return (
        <div className="space-y-6 pb-20">
            {confirmTarget && <ConfirmDialog message={`Удалить «${confirmTarget.title}»?`} onConfirm={async () => {
                await supabase.from('excursions').delete().eq('id', confirmTarget.id);
                setConfirmTarget(null);
                fetchExcursions();
            }} onCancel={() => setConfirmTarget(null)} />}

            {photoToRemove !== null && <ConfirmDialog message="Удалить это фото?" confirmLabel="Удалить" onConfirm={() => {
                const updated = photos.filter((_, i) => i !== photoToRemove);
                setFormData({ ...formData, image_urls: updated, image_url: updated[0] || '' });
                setPhotoToRemove(null);
            }} onCancel={() => setPhotoToRemove(null)} />}

            {/* ── FORM ── */}
            <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-[18px]">{isEditing ? 'edit' : 'add_circle'}</span>
                        </div>
                        <h2 className="text-sm font-bold text-slate-200">{isEditing ? t.editExcursion : t.newExcursion}</h2>
                    </div>
                </div>

                <div className="p-5 space-y-6">
                    {/* Media */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Фотогалерея ({photos.length})</label>
                        <div className="grid grid-cols-4 gap-2 text-left">
                            {photos.map((url: string, i: number) => (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-black/20">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button onClick={() => setPhotoToRemove(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-white text-[14px]">close</span></button>
                                </div>
                            ))}
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="aspect-square border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-slate-600 hover:text-primary hover:border-primary/40 transition-all"><span className="material-symbols-outlined text-[32px]">add_photo_alternate</span></button>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) handleFilesSelect(e.target.files); }} />
                    </div>

                    {/* Language Switcher */}
                    <div className="flex bg-black/30 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                        {['ru', 'en', 'tr', 'de', 'pl', 'ar', 'fa'].map(l => (
                            <button key={l} onClick={() => setActiveLang(l as any)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeLang === l ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-500'}`}>{l}</button>
                        ))}
                    </div>

                    <div className="space-y-4 text-left">
                        {activeLang === 'ru' ? (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Город</label><input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                    <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Название</label><input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                </div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Описание</label><textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Длительность</label><input value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                    <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Цена ($)</label><input type="number" value={formData.price_rub} onChange={e => setFormData({ ...formData, price_rub: parseInt(e.target.value) })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                </div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Что включено</label><textarea rows={2} value={formData.included} onChange={e => setFormData({ ...formData, included: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Место встречи</label><input value={formData.meeting_point} onChange={e => setFormData({ ...formData, meeting_point: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Город ({activeLang})</label><input value={formData[`city_${activeLang}`]} onChange={e => setFormData({ ...formData, [`city_${activeLang}`]: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                    <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Название ({activeLang})</label><input value={formData[`title_${activeLang}`]} onChange={e => setFormData({ ...formData, [`title_${activeLang}`]: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                </div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Описание ({activeLang})</label><textarea rows={3} value={formData[`description_${activeLang}`]} onChange={e => setFormData({ ...formData, [`description_${activeLang}`]: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Длительность ({activeLang})</label><input value={formData[`duration_${activeLang}`]} onChange={e => setFormData({ ...formData, [`duration_${activeLang}`]: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Что включено ({activeLang})</label><textarea rows={2} value={formData[`included_${activeLang}`]} onChange={e => setFormData({ ...formData, [`included_${activeLang}`]: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] uppercase text-slate-600 font-bold ml-1">Место встречи ({activeLang})</label><input value={formData[`meeting_point_${activeLang}`]} onChange={e => setFormData({ ...formData, [`meeting_point_${activeLang}`]: e.target.value })} className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm focus:border-primary/40 outline-none text-white" /></div>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        {isEditing && (
                            <button onClick={() => { setIsEditing(null); setFormData({ ...EMPTY_FORM }); }} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">Отмена</button>
                        )}
                        <button onClick={handleAutoTranslate} className="flex-1 py-4 bg-primary/10 border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2">
                             <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                             AI Перевод
                        </button>
                        <button onClick={handleSave} className="flex-[2] py-4 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95">Сохранить</button>
                    </div>
                </div>
            </div>

            {/* ── LIST ── */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Все экскурсии ({excursions.length})</h3>
                <div className="grid grid-cols-1 gap-4">
                    {excursions.map(ex => (
                        <div key={ex.id} className="bg-[#1a1a1d] p-4 rounded-3xl border border-white/5 flex items-center gap-4 text-left">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-black/40">
                                <img src={ex.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-primary uppercase tracking-wider">{ex.city}</p>
                                <h4 className="text-white font-bold truncate">{ex.title}</h4>
                                <div className="flex items-center gap-3 mt-1 underline decoration-white/5 underline-offset-4">
                                    <span className="text-[11px] text-slate-500">${ex.price_rub}</span>
                                    <span className="text-[11px] text-slate-500">{ex.duration}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(ex)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                                <button onClick={() => setConfirmTarget({ id: ex.id, title: ex.title })} className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400/60 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
