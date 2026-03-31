import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_FORM = {
    city: '', title: '', description: '', price_rub: 0,
    duration: '', included: '', meeting_point: '',
    image_url: '', image_urls: [] as string[],
    sort_number: 1, is_active: true
};

// ── Custom Confirm Dialog ──────────────────────────────────────────────────
const ConfirmDialog: React.FC<{
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ message, confirmLabel = 'Удалить', onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-28 px-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
        <div
            className="w-full max-w-sm bg-[#1a1a1d] rounded-3xl border border-white/10 p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-red-400 text-[24px]">delete_forever</span>
                </div>
                <p className="text-sm text-slate-200 font-semibold leading-snug">{message}</p>
                <p className="text-xs text-slate-500">Это действие нельзя отменить</p>
            </div>
            <div className="flex gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-slate-300 hover:bg-white/10 transition-all active:scale-95"
                >
                    Отмена
                </button>
                <button
                    onClick={onConfirm}
                    className="flex-1 py-3 bg-red-500/20 border border-red-500/30 rounded-2xl text-sm font-black text-red-400 hover:bg-red-500/30 transition-all active:scale-95"
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
const AdminExcursions: React.FC<{ t?: any }> = () => {
    const [excursions, setExcursions] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
    const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);
    const [photoToRemove, setPhotoToRemove] = useState<number | null>(null);
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
        setPhotoToRemove(null);
    };

    const handleSave = async () => {
        if (isEditing) {
            await supabase.from('excursions').update(formData).eq('id', isEditing.id);
        } else {
            await supabase.from('excursions').insert([formData]);
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

    const handleDelete = async () => {
        if (!confirmTarget) return;
        await supabase.from('excursions').delete().eq('id', confirmTarget.id);
        setConfirmTarget(null);
        fetchExcursions();
    };

    if (loading) return <div className="text-center py-10 opacity-50 animate-pulse">Загрузка...</div>;

    const photos: string[] = formData.image_urls || [];

    return (
        <>
            {/* ── Confirm delete excursion ── */}
            {confirmTarget && (
                <ConfirmDialog
                    message={`Удалить «${confirmTarget.title}»?`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmTarget(null)}
                />
            )}

            {/* ── Confirm remove photo ── */}
            {photoToRemove !== null && (
                <ConfirmDialog
                    message="Удалить это фото из галереи?"
                    confirmLabel="Удалить"
                    onConfirm={() => handleRemovePhoto(photoToRemove)}
                    onCancel={() => setPhotoToRemove(null)}
                />
            )}

            <div className="space-y-6 animate-in fade-in duration-500">
                {/* ── FORM ── */}
                <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                    {/* Form header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-[18px]">{isEditing ? 'edit' : 'add_circle'}</span>
                        </div>
                        <h2 className="text-sm font-bold text-slate-200">
                            {isEditing ? `Редактирование: ${isEditing.title}` : 'Новая экскурсия'}
                        </h2>
                    </div>

                    <div className="p-5 space-y-5">
                        {/* ── Photo Gallery ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Фотогалерея {photos.length > 0 && <span className="text-primary">({photos.length})</span>}
                                </label>
                                {uploading && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-primary">
                                        <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        Загрузка...
                                    </div>
                                )}
                            </div>

                            {photos.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {photos.map((url, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group bg-black/30">
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
                                            <button
                                                type="button"
                                                onClick={() => setPhotoToRemove(idx)}
                                                className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 active:scale-95"
                                            >
                                                <span className="material-symbols-outlined text-white text-[15px]">close</span>
                                            </button>
                                            {idx === 0 && (
                                                <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black bg-primary text-black px-2 py-0.5 rounded-full shadow">ГЛАВНОЕ</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full h-28 bg-black/20 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.99]"
                                >
                                    <span className="material-symbols-outlined text-primary text-[30px]">add_photo_alternate</span>
                                    <p className="text-[11px] text-slate-500 font-semibold">Нажмите для загрузки фото</p>
                                </button>
                            )}

                            {photos.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full py-2.5 border border-dashed border-white/10 rounded-2xl text-[11px] font-bold text-slate-500 hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                                    Добавить ещё фото
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

                        {/* ── Fields ── */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Город', key: 'city', ph: 'Анталья', span: 1 },
                                { label: 'Название', key: 'title', ph: 'Экскурсия на Памуккале', span: 1 },
                            ].map(f => (
                                <div key={f.key} className={`space-y-1 ${f.span === 2 ? 'col-span-2' : ''}`}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">{f.label}</label>
                                    <input
                                        value={(formData as any)[f.key]}
                                        onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                                        className="w-full bg-black/30 border border-white/8 rounded-xl p-3 text-sm outline-none focus:border-primary/40 transition-colors"
                                        placeholder={f.ph}
                                    />
                                </div>
                            ))}

                            <div className="space-y-1 col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Описание</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-black/30 border border-white/8 rounded-xl p-3 text-sm h-20 outline-none focus:border-primary/40 transition-colors resize-none"
                                    placeholder="Краткое описание маршрута..."
                                />
                            </div>

                            {[
                                { label: 'Цена ($)', key: 'price_rub', ph: '89', type: 'number' },
                                { label: 'Длительность', key: 'duration', ph: '8 часов' },
                                { label: 'Включено', key: 'included', ph: 'Транспорт, гид, обед' },
                                { label: 'Место встречи', key: 'meeting_point', ph: 'Лобби отеля' },
                            ].map(f => (
                                <div key={f.key} className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">{f.label}</label>
                                    <input
                                        type={f.type || 'text'}
                                        value={(formData as any)[f.key]}
                                        onChange={e => setFormData({ ...formData, [f.key]: f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })}
                                        className="w-full bg-black/30 border border-white/8 rounded-xl p-3 text-sm outline-none focus:border-primary/40 transition-colors"
                                        placeholder={f.ph}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Active toggle */}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`relative w-10 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-primary' : 'bg-white/10'}`}
                                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${formData.is_active ? 'left-5' : 'left-1'}`} />
                            </div>
                            <span className="text-sm font-semibold text-slate-300">Активна (видна клиентам)</span>
                        </label>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={handleSave}
                                disabled={uploading || !formData.title}
                                className="flex-1 bg-primary text-black font-black py-3.5 rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
                            >
                                {isEditing ? '✓ Сохранить изменения' : '+ Создать экскурсию'}
                            </button>
                            {isEditing && (
                                <button
                                    onClick={() => { setIsEditing(null); setFormData({ ...EMPTY_FORM }); }}
                                    className="px-5 bg-white/5 border border-white/10 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all active:scale-95"
                                >
                                    Отмена
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── LIST ── */}
                {excursions.length === 0 ? (
                    <div className="text-center py-12 text-slate-600">
                        <span className="material-symbols-outlined text-[48px] mb-2 block">travel_explore</span>
                        <p className="text-sm font-semibold">Экскурсий пока нет</p>
                        <p className="text-xs mt-1">Добавьте первую выше</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1">Всего: {excursions.length}</p>
                        {excursions.map(ex => {
                            const firstPhoto = ex.image_urls?.[0] || ex.image_url;
                            const photoCount = ex.image_urls?.length || (ex.image_url ? 1 : 0);
                            return (
                                <div key={ex.id} className="bg-[#1a1a1d] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors">
                                    <div className="flex gap-3 p-3.5 items-center">
                                        {/* Thumbnail */}
                                        <div className="relative w-[72px] h-[72px] bg-black/40 rounded-xl overflow-hidden flex-shrink-0">
                                            {firstPhoto
                                                ? <img src={firstPhoto} alt="" className="object-cover w-full h-full" />
                                                : <span className="material-symbols-outlined text-slate-700 text-[30px] absolute inset-0 m-auto">image</span>
                                            }
                                            {photoCount > 1 && (
                                                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-[10px]">photo_library</span>
                                                    {photoCount}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[10px] font-black bg-primary/15 text-primary px-2 py-0.5 rounded-full">{ex.city}</span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ex.is_active ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-slate-500'}`}>
                                                    {ex.is_active ? '● Активна' : '○ Скрыта'}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-slate-100 truncate text-sm leading-tight">{ex.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">${ex.price_rub} · {ex.duration}</p>
                                        </div>

                                        {/* Buttons */}
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => startEdit(ex)}
                                                className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                            </button>
                                            <button
                                                onClick={() => setConfirmTarget({ id: ex.id, title: ex.title })}
                                                className="w-8 h-8 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all active:scale-90"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminExcursions;
