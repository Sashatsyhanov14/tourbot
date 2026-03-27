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
    const [managers, setManagers] = useState<any[]>([]);
    const [newManagerId, setNewManagerId] = useState('');
    const [managerMsg, setManagerMsg] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        fetchManagers();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { data: allReqs, count: rCount } = await supabase.from('requests').select('*');

        if (allReqs) {
            const newReqs = allReqs.filter((r: any) => r.status === 'new').length;
            const revenue = allReqs.filter((r: any) => r.status !== 'cancelled').reduce((acc: number, curr: any) => acc + (Number(curr.price_rub) || 0), 0);
            const citiesMap: { [key: string]: number } = {};
            allReqs.forEach((r: any) => {
                const city = r.excursion_title?.split(' ')[0] || 'Другие';
                citiesMap[city] = (citiesMap[city] || 0) + 1;
            });
            const sortedCities = Object.entries(citiesMap).map(([name, count]) => ({ name, count })).sort((a, b) => (b.count as number) - (a.count as number)).slice(0, 5);
            setStats({ totalUsers: uCount || 0, totalRequests: rCount || 0, newRequests: newReqs, totalRevenue: revenue, topCities: sortedCities });
        }
        setLoading(false);
    };

    const fetchManagers = async () => {
        const { data } = await supabase.from('users').select('telegram_id, username, role').in('role', ['manager', 'founder']);
        setManagers(data || []);
    };

    const handleAddManager = async () => {
        if (!newManagerId || isNaN(parseInt(newManagerId))) return;
        const id = parseInt(newManagerId);
        const { data: existing } = await supabase.from('users').select('*').eq('telegram_id', id).single();
        if (!existing) {
            setManagerMsg(t.managerAddError || '❌ Пользователь не найден. Пусть сначала нажмёт /start.');
            return;
        }
        const { error } = await supabase.from('users').update({ role: 'manager' }).eq('telegram_id', id);
        if (error) { setManagerMsg(t.managerAddFail || '❌ Ошибка!'); return; }
        setManagerMsg((t.managerAddSuccess || '✅ ID {id} теперь Менеджер.').replace('{id}', String(id)));
        setNewManagerId('');
        fetchManagers();
    };

    const handleRemoveManager = async (id: number) => {
        await supabase.from('users').update({ role: 'user' }).eq('telegram_id', id);
        setManagerMsg((t.managerRemoveSuccess || '🗑️ Сотрудник {id} удалён.').replace('{id}', String(id)));
        fetchManagers();
    };

    if (loading) return <div className="text-center py-20 opacity-50 animate-pulse">{t.analyzing || 'Анализ данных...'}</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Stats Grid */}
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

            {/* Top Directions */}
            {stats.topCities.length > 0 && (
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
                                    <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${(city.count / Math.max(stats.totalRequests, 1)) * 100}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{city.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New Requests Alert */}
            <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-400">notifications_active</span>
                    <p className="text-xs font-bold text-blue-100 uppercase tracking-wide">Новых заявок ожидает внимания</p>
                </div>
                <span className="bg-blue-500 text-black text-[10px] font-black px-3 py-1 rounded-full">{stats.newRequests}</span>
            </div>

            {/* Manager Management */}
            <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-sm">manage_accounts</span>
                    {t.manageManagers || 'Управление Менеджерами'}
                </h3>

                <div className="flex gap-2">
                    <input
                        type="number"
                        value={newManagerId}
                        onChange={e => setNewManagerId(e.target.value)}
                        placeholder={t.enterTgId || 'Telegram ID нового менеджера'}
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/40 transition-all"
                    />
                    <button
                        onClick={handleAddManager}
                        className="px-5 py-3 bg-primary/20 text-primary border border-primary/30 rounded-xl text-sm font-bold hover:bg-primary/30 transition-all active:scale-95"
                    >
                        {t.assignEmployee || '+ Добавить'}
                    </button>
                </div>

                {managerMsg && (
                    <p className="text-xs text-primary/80 bg-primary/10 border border-primary/20 p-3 rounded-xl">{managerMsg}</p>
                )}

                {managers.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.activeEmployees || 'Действующие сотрудники'}</p>
                        {managers.map(m => (
                            <div key={m.telegram_id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                <div>
                                    <p className="text-sm font-bold text-slate-200">@{m.username || '—'}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{m.telegram_id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${m.role === 'founder' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'}`}>
                                        {m.role === 'founder' ? (t.ownerBadge || 'Владелец') : (t.roleManager || 'Менеджер')}
                                    </span>
                                    {m.role !== 'founder' && (
                                        <button
                                            onClick={() => handleRemoveManager(m.telegram_id)}
                                            className="text-red-400/60 hover:text-red-400 transition-colors p-1"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminStats;
