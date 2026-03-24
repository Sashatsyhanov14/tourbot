import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AdminRequests: React.FC<{ t?: any }> = () => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
        // Реальное время: слушаем изменения в таблице requests
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
            .select('*, users(username)')
            .order('created_at', { ascending: false });
        setRequests(data || []);
        setLoading(false);
    };

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('requests').update({ status }).eq('id', id);
        fetchRequests();
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'contacted': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'done': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    if (loading) return <div className="text-center py-10 opacity-50">Загрузка заявок...</div>;

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {requests.length === 0 && <div className="text-center py-20 text-slate-500">Заявок пока нет</div>}

            {requests.map(req => (
                <div key={req.id} className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(req.status)}`}>
                                    {req.status.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-slate-500">{new Date(req.created_at).toLocaleString('ru-RU')}</span>
                            </div>
                            <h4 className="font-bold text-slate-100 text-lg">{req.excursion_title}</h4>
                        </div>
                        <p className="text-primary font-bold text-lg">{req.price_rub}₽</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                            <p className="text-slate-500 mb-1">КЛИЕНТ</p>
                            <p className="font-medium text-slate-200">@{req.users?.username || 'user'}</p>
                            <p className="font-medium text-slate-200 mt-1">{req.full_name}</p>
                        </div>
                        <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                            <p className="text-slate-500 mb-1">ДЕТАЛИ</p>
                            <p className="font-medium text-slate-200">📅 {req.tour_date}</p>
                            <p className="font-medium text-slate-200 mt-1 truncate">🏨 {req.hotel_name}</p>
                        </div>
                    </div>

                    <div className="flex gap-2 border-t border-white/5 pt-4">
                        <button onClick={() => updateStatus(req.id, 'contacted')} className="flex-1 py-2 text-[10px] font-bold bg-yellow-500/10 text-yellow-400 rounded-xl hover:bg-yellow-500/20 transition-all">СВЯЗАЛСЯ</button>
                        <button onClick={() => updateStatus(req.id, 'done')} className="flex-1 py-2 text-[10px] font-bold bg-green-500/10 text-green-400 rounded-xl hover:bg-green-500/20 transition-all">ГОТОВО</button>
                        <button onClick={() => updateStatus(req.id, 'cancelled')} className="flex-1 py-2 text-[10px] font-bold bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all">ОТМЕНА</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AdminRequests;
