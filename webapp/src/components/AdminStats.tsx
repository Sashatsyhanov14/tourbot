import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AdminStats: React.FC<{ t: any }> = ({ t }) => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRequests: 0,
        newRequests: 0,
        totalRevenue: 0,
        topCities: [] as any[]
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { data: allReqs, count: rCount } = await supabase.from('requests').select('*');

        if (allReqs) {
            const newReqs = allReqs.filter(r => r.status === 'new').length;
            const revenue = allReqs.filter(r => r.status !== 'cancelled').reduce((acc, curr) => acc + (Number(curr.price_rub) || 0), 0);

            // Группировка по городам (через экскурсии или название, если сохранили)
            // Здесь для простоты просто считаем топ из реестра заявок
            const citiesMap: any = {};
            allReqs.forEach(r => {
                const city = r.excursion_title?.split(' ')[0] || 'Другие'; // Упрощенно
                citiesMap[city] = (citiesMap[city] || 0) + 1;
            });
            const sortedCities = Object.entries(citiesMap).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

            setStats({
                totalUsers: uCount || 0,
                totalRequests: rCount || 0,
                newRequests: newReqs,
                totalRevenue: revenue,
                topCities: sortedCities
            });
        }
        setLoading(false);
    };

    if (loading) return <div className="text-center py-20 opacity-50">Анализ данных...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.statsTotalUsers}</p>
                    <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
                </div>
                <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.statsTotalRequests}</p>
                    <p className="text-3xl font-black text-white">{stats.totalRequests}</p>
                </div>
                <div className="bg-primary/10 p-6 rounded-3xl border border-primary/20 col-span-2">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{t.statsRevenue}</p>
                    <p className="text-4xl font-black text-white">{stats.totalRevenue.toLocaleString()} ₽</p>
                    <p className="text-[10px] text-primary/60 mt-2 font-bold uppercase tracking-tight">* С учётом всех активных заявок</p>
                </div>
            </div>

            <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5">
                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
                    ТОП НАПРАВЛЕНИЙ
                </h3>
                <div className="space-y-3">
                    {stats.topCities.map(city => (
                        <div key={city.name} className="flex items-center gap-4">
                            <span className="text-xs text-slate-400 w-20 truncate font-medium">{city.name}</span>
                            <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-1000"
                                    style={{ width: `${(city.count / stats.totalRequests) * 100}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{city.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-400">notifications_active</span>
                    <p className="text-xs font-bold text-blue-100 uppercase tracking-wide">Запросов ожидает внимания</p>
                </div>
                <span className="bg-blue-500 text-black text-[10px] font-black px-3 py-1 rounded-full">{stats.newRequests}</span>
            </div>
        </div>
    );
};

export default AdminStats;
