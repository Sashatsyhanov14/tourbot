import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AdminExcursions: React.FC<{ t?: any }> = () => {
    const [excursions, setExcursions] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        city: '', title: '', description: '', price_rub: 0, duration: '', included: '', meeting_point: '', image_url: '', sort_number: 1, is_active: true
    });

    useEffect(() => { fetchExcursions(); }, []);

    const fetchExcursions = async () => {
        setLoading(true);
        const { data } = await supabase.from('excursions').select('*').order('sort_number', { ascending: true });
        setExcursions(data || []);
        setLoading(false);
    };

    const handlePhotoUpload = async (file: File) => {
        if (!file) return;
        setUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const fileName = `excursion_${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from('excursion_photos')
                .upload(fileName, file, { upsert: true, contentType: file.type });

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from('excursion_photos')
                .getPublicUrl(fileName);

            setFormData(prev => ({ ...prev, image_url: urlData.publicUrl }));
        } catch (e: any) {
            alert('Ошибка загрузки: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (isEditing) {
            await supabase.from('excursions').update(formData).eq('id', isEditing.id);
        } else {
            await supabase.from('excursions').insert([formData]);
        }
        setIsEditing(null);
        setFormData({ city: '', title: '', description: '', price_rub: 0, duration: '', included: '', meeting_point: '', image_url: '', sort_number: 1, is_active: true });
        fetchExcursions();
    };

    const startEdit = (ex: any) => {
        setIsEditing(ex);
        setFormData({ ...ex });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Удалить экскурсию?')) {
            await supabase.from('excursions').delete().eq('id', id);
            fetchExcursions();
        }
    };

    if (loading) return <div className="text-center py-10 opacity-50 animate-pulse">Загрузка экскурсий...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* FORM */}
            <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5 space-y-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">{isEditing ? 'edit' : 'add_circle'}</span>
                    {isEditing ? 'Редактировать экскурсию' : 'Добавить экскурсию'}
                </h2>

                {/* Photo upload */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Фото</label>
                    <div
                        className="relative w-full h-40 bg-black/30 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/40 transition-all group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {formData.image_url ? (
                            <img src={formData.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : null}
                        <div className={`flex flex-col items-center gap-2 z-10 ${formData.image_url ? 'opacity-0 group-hover:opacity-100 bg-black/60 absolute inset-0 flex items-center justify-center' : ''}`}>
                            {uploading ? (
                                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-primary text-[32px]">add_photo_alternate</span>
                                    <p className="text-[11px] text-slate-400 font-bold">{formData.image_url ? 'Заменить фото' : 'Загрузить фото'}</p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                        />
                    </div>
                    {/* Or paste URL */}
                    <input
                        value={formData.image_url}
                        onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                        className="w-full bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 outline-none focus:border-primary/30"
                        placeholder="Или вставьте URL фото..."
                    />
                </div>

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
                        <button onClick={() => { setIsEditing(null); setFormData({ city: '', title: '', description: '', price_rub: 0, duration: '', included: '', meeting_point: '', image_url: '', sort_number: 1, is_active: true }); }} className="px-6 bg-white/5 border border-white/10 py-3 rounded-2xl font-bold">Отмена</button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="space-y-3">
                {excursions.map(ex => (
                    <div key={ex.id} className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="flex gap-4 p-4 items-center">
                            <div className="w-20 h-20 bg-black/40 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
                                {ex.image_url
                                    ? <img src={ex.image_url} alt="" className="object-cover w-full h-full" />
                                    : <span className="material-symbols-outlined text-slate-600 text-[36px]">image</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">{ex.city}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ex.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}`}>
                                        {ex.is_active ? 'Активна' : 'Скрыта'}
                                    </span>
                                </div>
                                <h4 className="font-bold text-slate-200 truncate text-sm">{ex.title}</h4>
                                <p className="text-xs text-slate-400">${ex.price_rub} · {ex.duration}</p>
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
                ))}
            </div>
        </div>
    );
};

export default AdminExcursions;
