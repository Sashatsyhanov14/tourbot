import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Faq {
    id: string;
    topic: string;
    content_ru: string;
}

export default function AdminFaq({ t }: { t: any }) {
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Faq>>({});

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        setLoading(true);
        const { data } = await supabase.from('faq').select('*').order('created_at', { ascending: true });
        if (data) setFaqs(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.topic || !formData.content_ru) return;

        if (editingId === 'new') {
            await supabase.from('faq').insert([{ topic: formData.topic, content_ru: formData.content_ru }]);
        } else {
            await supabase.from('faq').update({ topic: formData.topic, content_ru: formData.content_ru }).eq('id', editingId);
        }
        setEditingId(null);
        setFormData({});
        fetchFaqs();
    };

    const handleDelete = async (id: string) => {
        if (confirm(t.deleteFaqConfirm)) {
            await supabase.from('faq').delete().eq('id', id);
            fetchFaqs();
        }
    };

    if (loading) return <div className="text-center p-4 animate-pulse text-on-surface-variant">Загрузка FAQ...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pl-1">
                <h3 className="text-lg font-headline font-bold text-on-surface">{t.manageFaq}</h3>
                <button
                    onClick={() => { setEditingId('new'); setFormData({}); }}
                    className="flex items-center gap-1 bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-sm font-bold active:scale-95 transition-all hover:bg-primary/30"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {t.addFaq}
                </button>
            </div>

            {editingId && (
                <div className="glass-card p-4 rounded-xl space-y-3 border border-primary/30 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

                    <h4 className="font-bold text-primary mb-3 text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">{editingId === 'new' ? 'add_circle' : 'edit_square'}</span>
                        {editingId === 'new' ? t.newFaq : t.editFaq}
                    </h4>

                    <div>
                        <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider pl-1 mb-1 block">Тема / Konu</label>
                        <input
                            type="text"
                            placeholder={t.faqTopic}
                            value={formData.topic || ''}
                            onChange={e => setFormData({ ...formData, topic: e.target.value })}
                            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors mb-2"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider pl-1 mb-1 block">Ответ / Cevap</label>
                        <textarea
                            placeholder={t.faqContent}
                            value={formData.content_ru || ''}
                            onChange={e => setFormData({ ...formData, content_ru: e.target.value })}
                            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface min-h-[120px] focus:border-primary/50 focus:outline-none transition-colors"
                        />
                    </div>

                    <div className="flex gap-3 pt-3">
                        <button onClick={() => setEditingId(null)} className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors hover:bg-surface-container-highest">
                            {t.cancelBtn}
                        </button>
                        <button onClick={handleSave} className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(208,188,255,0.3)] hover:brightness-110 active:scale-95">
                            <span className="material-symbols-outlined text-[20px]">save</span>
                            {t.saveBtn}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {faqs.map(f => (
                    <div key={f.id} className="glass-card p-4 rounded-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="flex items-start justify-between pr-20">
                            <h4 className="font-headline font-bold text-on-surface mb-1">{f.topic}</h4>
                        </div>
                        <p className="text-sm text-on-surface-variant line-clamp-3 mt-2">{f.content_ru}</p>

                        <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => { setEditingId(f.id); setFormData(f); }} className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center transition-colors hover:bg-surface-container-highest active:scale-90 opacity-80 hover:opacity-100">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => handleDelete(f.id)} className="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center transition-all hover:bg-error hover:text-white active:scale-90 opacity-80 hover:opacity-100">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
