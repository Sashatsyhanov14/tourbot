import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_FORM = {
    city: '', title: '', description: '', price_rub: 0,
    duration: '', included: '', meeting_point: '',
    image_url: '', image_urls: [] as string[],
    sort_number: 1, is_active: true
};

const AdminExcursions: React.FC<{ t?: any }> = () => {
    const [excursions, setExcursions] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchExcursions(); }, []);

    const fetchExcursions = async () => {
        setLoading(true);
        const { data } = await supabase.from('excursions').select('*').order('sort_number', { ascending: true });
        setExcursions(data || []);
        setLoading(false);
    };

    // Upload multiple files
    const handleFilesSelect = async (files: FileList) => {
        setUploading(true);
        const newUrls: string[] = [];
        try {
            for (const file of Array.from(files)) {
                const ext = file.name.split('.').pop();
                const fileName = `excursion_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const { error } = await supabase.storage
                    .from('excursion_photos')
                    .upload(fileName, file, { upsert: true, contentType: file.type });
                if (error) throw error;
                const { data: urlData } = supabase.storage.from('excursion_photos').getPublicUrl(fileName);
                newUrls.push(urlData.publicUrl);
            }
            setFormData(prev => ({
                ...prev,
                image_urls: [...(prev.image_urls || []), ...newUrls],
                // Keep image_url as the first photo for backward compat
                image_url: prev.image_url || newUrls[0] || ''
            }));
        } catch (e: any) {
            alert('Ошибка загрузки: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = (idx: number) => {
        setFormData(prev => {
            const updated = prev.image_urls.filter((_, i) => i !== idx);
            return { ...prev, image_urls: updated, image_url: updated[0] || '' };
        });
    };

    const handleSave = async () => {
        const payload = { ...formData };
        if (isEditing) {
            await supabase.from('excursions').update(payload).eq('id', isEditing.id);
        } else {
            await supabase.from('excursions').insert([payload]);
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

    const handleDelete = async (id: string) => {
        if (confirm('Удалить экскурсию?')) {
            await supabase.from('excursions').delete().eq('id', id);
            fetchExcursions();
        }
    };

    if (loading) return <div className="text-center py-10 opacity-50 animate-pulse">Загрузка...</div>;

    const photos: string[] = formData.image_urls || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* FORM */}
            <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5 space-y-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">{isEditing ? 'edit' : 'add_circle'}</span>
                    {isEditing ? 'Редактировать экскурсию' : 'Добавить экскурсию'}
                </h2>

                {/* ── PHOTO GALLERY ── */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Фотогалерея ({photos.length})
                        </label>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-xl text-[11px] font-bold active:scale-95 transition-all disabled:opacity-50"
                        >
                            {uploading
                                ? <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                : <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                            }
                            {uploading ? 'Загрузка...' : 'Добавить фото'}
                        </button>
                    </div>

                    {/* Photo grid */}
                    {photos.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {photos.map((url, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group bg-black/30">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePhoto(idx)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-white text-[14px]">close</span>
                                    </button>
                                    {idx === 0 && (
                                        <span className="absolute bottom-1 left-1 text-[9px] font-black bg-primary text-black px-1.5 py-0.5 rounded-full">ГЛАВНОЕ</span>
                                    )}
                                </div>
                            ))}
                            {/* Add more tile */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-xl bg-black/20 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-primary/40 transition-all"
                            >
                                <span className="material-symbols-outlined text-slate-600 text-[24px]">add</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-32 bg-black/20 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 transition-all cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-primary text-[32px]">add_photo_alternate</span>
                            <p className="text-[11px] text-slate-500 font-bold">Нажмите для загрузки фото</p>
                        </button>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => e.target.files && e.target.files.length > 0 && handleFilesSelect(e.target.files)}
                    />
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Город</label>
                        <input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-primary/30" placeholder="Анталья" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Название</label>
                        <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-primary/30" placeholder="Экскурсия на Памуккале" />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Описание</label>
                        <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm h-20 outline-none focus:border-primary/30 resize-none" placeholder="Краткое описание..." />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Цена ($)</label>
                        <input type="number" value={formData.price_rub} onChange={e => setFormData({ ...formData, price_rub: parseInt(e.target.value) || 0 })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-primary/30" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Длительность</label>
                        <input value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-primary/30" placeholder="8 часов" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Включено</label>
                        <input value={formData.included} onChange={e => setFormData({ ...formData, included: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-primary/30" placeholder="Транспорт, гид" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Место встречи</label>
                        <input value={formData.meeting_point} onChange={e => setFormData({ ...formData, meeting_point: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-primary/30" placeholder="Лобби отеля" />
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={uploading} className="flex-1 bg-primary text-black font-bold py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-50">
                        {isEditing ? 'Обновить' : 'Создать'}
                    </button>
                    {isEditing && (
                        <button onClick={() => { setIsEditing(null); setFormData({ ...EMPTY_FORM }); }} className="px-6 bg-white/5 border border-white/10 py-3 rounded-2xl font-bold">Отмена</button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="space-y-3">
                {excursions.map(ex => {
                    const firstPhoto = (ex.image_urls?.[0]) || ex.image_url;
                    const photoCount = (ex.image_urls?.length) || (ex.image_url ? 1 : 0);
                    return (
                        <div key={ex.id} className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                            <div className="flex gap-4 p-4 items-center">
                                <div className="relative w-20 h-20 bg-black/40 rounded-2xl overflow-hidden flex-shrink-0">
                                    {firstPhoto
                                        ? <img src={firstPhoto} alt="" className="object-cover w-full h-full" />
                                        : <span className="material-symbols-outlined text-slate-600 text-[36px] absolute inset-0 flex items-center justify-center">image</span>
                                    }
                                    {photoCount > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">+{photoCount - 1}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">{ex.city}</span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ex.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}`}>
                                            {ex.is_active ? 'Активна' : 'Скрыта'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-slate-200 truncate text-sm">{ex.title}</h4>
                                    <p className="text-xs text-slate-400">${ex.price_rub} · {ex.duration} · 📷 {photoCount} фото</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => startEdit(ex)} className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(ex.id)} className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminExcursions;
