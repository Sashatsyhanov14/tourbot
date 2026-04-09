import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AdminRequests: React.FC<{ t?: any }> = () => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'new' | 'deals' | 'archive'>('all');

    useEffect(() => {
        fetchRequests();
        const channel = supabase.channel('requests-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('requests')
            .select('*, users(username, telegram_id)')
            .order('created_at', { ascending: false });
        setRequests(data || []);
        setLoading(false);
    };

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('requests').update({ status }).eq('id', id);
        fetchRequests();
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'new': return { label: 'НОВАЯ', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: 'new_releases' };
            case 'contacted': return { label: 'СВЯЗАЛИСЬ', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: 'ring_volume' };
            case 'done': return { label: 'СДЕЛКА', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: 'verified' };
            case 'cancelled': return { label: 'ОТМЕНА', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: 'cancel' };
            default: return { label: status.toUpperCase(), color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: 'help' };
        }
    };

    const filteredRequests = requests.filter(req => {
        if (filter === 'all') return true;
        if (filter === 'new') return req.status === 'new';
        if (filter === 'deals') return req.status === 'contacted' || req.status === 'done';
        if (filter === 'archive') return req.status === 'cancelled';
        return true;
    });

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Загрузка заявок...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Filter Tabs */}
            <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 sticky top-0 z-10 backdrop-blur-md">
                {[
                    { id: 'all', label: 'Все', icon: 'list' },
                    { id: 'new', label: 'Новые', icon: 'notification_important' },
                    { id: 'deals', label: 'Сделки', icon: 'handshake' },
                    { id: 'archive', label: 'Архив', icon: 'archive' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filter === tab.id ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-[1.02]' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {filteredRequests.length === 0 ? (
                <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 py-20 flex flex-col items-center justify-center gap-4">
                    <span className="material-symbols-outlined text-6xl text-slate-800">inbox</span>
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Нет заявок в этой категории</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map(req => {
                        const s = getStatusInfo(req.status);
                        return (
                            <div key={req.id} className="bg-[#1a1a1d] p-0 rounded-3xl border border-white/5 overflow-hidden transition-all hover:border-white/10 group">
                                {/* Header / Status Bar */}
                                <div className={`px-5 py-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02]`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined text-[14px] ${s.color.split(' ')[0]}`}>{s.icon}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${s.color.split(' ')[0]}`}>{s.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                        <span className="text-[9px] font-bold">{new Date(req.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Main Info */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-white text-lg leading-tight group-hover:text-primary transition-colors">{req.excursion_title}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-slate-500">@{req.users?.username || 'user'}</span>
                                                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                                <span className="text-[10px] font-medium text-slate-400">{req.full_name}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-2xl font-black text-primary tracking-tighter">{req.price_rub.toLocaleString()}₽</p>
                                            <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">цена тура</p>
                                        </div>
                                    </div>

                                    {/* Detail Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-2">
                                            <div className="flex items-center gap-2 text-slate-500 uppercase tracking-widest text-[8px] font-black">
                                                <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                                Дата выезда
                                            </div>
                                            <p className="text-xs font-bold text-slate-200">{req.tour_date}</p>
                                        </div>
                                        <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-2">
                                            <div className="flex items-center gap-2 text-slate-500 uppercase tracking-widest text-[8px] font-black">
                                                <span className="material-symbols-outlined text-[12px]">hotel</span>
                                                Отель / Вилла
                                            </div>
                                            <p className="text-xs font-bold text-slate-200 truncate">{req.hotel_name}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2">
                                        {req.status === 'new' && (
                                            <button 
                                                onClick={() => updateStatus(req.id, 'contacted')} 
                                                className="flex-1 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">chat</span>
                                                Связался
                                            </button>
                                        )}
                                        {req.status !== 'done' && (
                                            <button 
                                                onClick={() => updateStatus(req.id, 'done')} 
                                                className="flex-1 py-3 bg-green-500/10 text-green-400 border border-green-500/20 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                ЗАКРЫТЬ СДЕЛКУ
                                            </button>
                                        )}
                                        {req.status !== 'cancelled' && (
                                            <button 
                                                onClick={() => updateStatus(req.id, 'cancelled')} 
                                                className="px-4 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all flex items-center justify-center"
                                                title="Отменить"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminRequests;
