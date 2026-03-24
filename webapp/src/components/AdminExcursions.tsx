import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AdminExcursions: React.FC<{ t?: any }> = () => {
    const [excursions, setExcursions] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        city: '', title: '', description: '', price_rub: 0, duration: '', included: '', meeting_point: '', image_url: '', sort_number: 1, is_active: true
    });

    useEffect(() => {
        fetchExcursions();
    }, []);

    const fetchExcursions = async () => {
        setLoading(true);
        const { data } = await supabase.from('excursions').select('*').order('sort_number', { ascending: true });
        setExcursions(data || []);
        setLoading(false);
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

    if (loading) return <div className="text-center py-10 opacity-50">Загрузка экскурсий...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* FORM */}
            <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{isEditing ? 'edit' : 'add_circle'}</span>
                    {isEditing ? 'Редактировать экскурсию' : 'Добавить экскурсию'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Город</label>
                        <input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" placeholder="Москва" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Название</label>
                        <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" placeholder="Обзорная экскурсия" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Описание</label>
                        <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm h-24" placeholder="Краткое описание для клиента..." />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Цена (₽)</label>
                        <input type="number" value={formData.price_rub} onChange={e => setFormData({ ...formData, price_rub: parseInt(e.target.value) })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Длительность</label>
                        <input value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" placeholder="3 часа" />
                    </div>
                </div>

                <div className="flex gap-2 pt-4">
                    <button onClick={handleSave} className="flex-1 bg-primary text-black font-bold py-3 rounded-2xl active:scale-95 transition-all">
                        {isEditing ? 'Обновить' : 'Создать'}
                    </button>
                    {isEditing && (
                        <button onClick={() => setIsEditing(null)} className="px-6 bg-white/5 border border-white/10 py-3 rounded-2xl font-bold">Отмена</button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="space-y-4">
                {excursions.map(ex => (
                    <div key={ex.id} className="bg-[#1a1a1d] p-4 rounded-3xl border border-white/5 flex gap-4 items-center">
                        <div className="w-16 h-16 bg-black/40 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
                            {ex.image_url ? <img src={ex.image_url} alt="" className="object-cover w-full h-full" /> : <span className="material-symbols-outlined text-slate-600">image</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">{ex.city}</span>
                                <span className="text-[10px] text-slate-500">#{ex.sort_number}</span>
                            </div>
                            <h4 className="font-bold truncate text-slate-200 mt-1">{ex.title}</h4>
                            <p className="text-xs text-slate-400">{ex.price_rub}₽ • {ex.duration}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => startEdit(ex)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                            <button onClick={() => handleDelete(ex.id)} className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminExcursions;
