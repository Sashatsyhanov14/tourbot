import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PAYOUT_PREFIX = 'PAYOUT_RECORD:';

const AdminStats: React.FC<{ t: any }> = ({ t }) => {
    const [stats, setStats] = useState({ totalUsers: 0, totalRequests: 0, newRequests: 0, totalRevenue: 0 });
    const [referralRows, setReferralRows] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [newManagerId, setNewManagerId] = useState('');
    const [managerMsg, setManagerMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [payoutMsg, setPayoutMsg] = useState<{ [id: number]: string }>({});

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchReferralRows(), fetchManagers()]);
        setLoading(false);
    };

    const fetchStats = async () => {
        const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { data: allReqs, count: rCount } = await supabase.from('requests').select('*');
        if (allReqs) {
            const newReqs = allReqs.filter((r: any) => r.status === 'new').length;
            const revenue = allReqs.filter((r: any) => r.status !== 'cancelled').reduce((acc: number, curr: any) => acc + (Number(curr.price_rub) || 0), 0);
            setStats({ totalUsers: uCount || 0, totalRequests: rCount || 0, newRequests: newReqs, totalRevenue: revenue });
        }
    };

    const fetchReferralRows = async () => {
        // Get all referrers (users with at least one referral)
        const { data: referrers } = await supabase
            .from('users')
            .select('telegram_id, username, balance')
            .not('telegram_id', 'is', null);

        if (!referrers) return;

        const rows = await Promise.all(referrers.map(async (ref: any) => {
            // Count users they invited
            const { count: invitedCount } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('referrer_id', ref.telegram_id);

            if (!invitedCount) return null; // Skip if no referrals

            // Count active requests from their invitees
            const { data: invitees } = await supabase
                .from('users')
                .select('telegram_id')
                .eq('referrer_id', ref.telegram_id);

            const inviteeIds = (invitees || []).map((u: any) => u.telegram_id);
            let requestCount = 0;
            let revenue = 0;
            if (inviteeIds.length > 0) {
                const { data: reqs } = await supabase
                    .from('requests')
                    .select('price_rub, status')
                    .in('user_id', inviteeIds)
                    .neq('status', 'cancelled');
                requestCount = reqs?.length || 0;
                revenue = (reqs || []).reduce((sum: number, r: any) => sum + (Number(r.price_rub) || 0), 0);
            }

            // Payout history from chat_history
            const { data: payouts } = await supabase
                .from('chat_history')
                .select('content, created_at')
                .eq('user_id', ref.telegram_id)
                .like('content', `${PAYOUT_PREFIX}%`)
                .order('created_at', { ascending: false });

            const totalPaid = (payouts || []).reduce((sum: number, p: any) => {
                const match = p.content.match(/\$?([\d.]+)/);
                return sum + (match ? parseFloat(match[1]) : 0);
            }, 0);

            return {
                telegram_id: ref.telegram_id,
                username: ref.username,
                balance: ref.balance || 0,
                invitedCount,
                requestCount,
                revenue,
                totalPaid,
                payouts: payouts || []
            };
        }));

        setReferralRows(rows.filter(Boolean));
    };

    const fetchManagers = async () => {
        const { data } = await supabase.from('users').select('telegram_id, username, role').in('role', ['manager', 'founder']);
        setManagers(data || []);
    };

    const handlePayout = async (ref: any) => {
        if (ref.balance <= 0) {
            setPayoutMsg(prev => ({ ...prev, [ref.telegram_id]: '⚠️ Баланс равен 0' }));
            return;
        }
        const amount = ref.balance;
        // Zero out balance
        await supabase.from('users').update({ balance: 0 }).eq('telegram_id', ref.telegram_id);
        // Log payout in chat_history
        await supabase.from('chat_history').insert({
            user_id: ref.telegram_id,
            role: 'assistant',
            content: `${PAYOUT_PREFIX} $${amount} — выплачено ${new Date().toLocaleDateString('ru-RU')}`
        });
        setPayoutMsg(prev => ({ ...prev, [ref.telegram_id]: `✅ Выплачено $${amount}` }));
        fetchReferralRows();
    };

    const handleAddManager = async () => {
        if (!newManagerId || isNaN(parseInt(newManagerId))) return;
        const id = parseInt(newManagerId);
        const { data: existing } = await supabase.from('users').select('*').eq('telegram_id', id).single();
        if (!existing) { setManagerMsg(t.managerAddError || '❌ Пользователь не найден.'); return; }
        await supabase.from('users').update({ role: 'manager' }).eq('telegram_id', id);
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
                <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.statsTotalUsers}</p>
                    <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
                </div>
                <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.statsTotalRequests}</p>
                    <p className="text-3xl font-black text-white">{stats.totalRequests}</p>
                </div>
                <div className="bg-primary/10 p-5 rounded-3xl border border-primary/20 col-span-2">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{t.statsRevenue}</p>
                    <p className="text-4xl font-black text-white">${stats.totalRevenue.toLocaleString()}</p>
                </div>
            </div>

            {/* New requests alert */}
            {stats.newRequests > 0 && (
                <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-400">notifications_active</span>
                        <p className="text-xs font-bold text-blue-100 uppercase tracking-wide">Новых заявок ожидает</p>
                    </div>
                    <span className="bg-blue-500 text-black text-[10px] font-black px-3 py-1 rounded-full">{stats.newRequests}</span>
                </div>
            )}

            {/* Referral Analytics + Payouts */}
            {referralRows.length > 0 && (
                <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                        <h3 className="text-sm font-bold text-slate-200">Реферальная аналитика и выплаты</h3>
                    </div>
                    <div className="divide-y divide-white/5">
                        {referralRows.map(ref => (
                            <div key={ref.telegram_id} className="p-4 space-y-3">
                                {/* Header row */}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-100 truncate">@{ref.username}</p>
                                        <p className="text-[10px] text-slate-500 font-mono">{ref.telegram_id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-primary">${ref.balance}</p>
                                        <p className="text-[9px] text-slate-500 uppercase">баланс</p>
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Привёл', value: ref.invitedCount, color: 'text-blue-400' },
                                        { label: 'Заявок', value: ref.requestCount, color: 'text-green-400' },
                                        { label: 'Выручка', value: `$${ref.revenue}`, color: 'text-primary' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-black/20 p-2 rounded-xl text-center">
                                            <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                                            <p className="text-[9px] text-slate-600 uppercase">{s.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Payout button + history */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePayout(ref)}
                                        disabled={ref.balance <= 0}
                                        className="flex-1 py-2.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        💸 Выплатить ${ref.balance}
                                    </button>
                                    {ref.totalPaid > 0 && (
                                        <div className="px-3 py-2.5 bg-black/20 rounded-xl text-center min-w-[80px]">
                                            <p className="text-[10px] font-black text-slate-400">${ref.totalPaid.toFixed(0)}</p>
                                            <p className="text-[8px] text-slate-600 uppercase">выплачено</p>
                                        </div>
                                    )}
                                </div>

                                {/* Payout feedback */}
                                {payoutMsg[ref.telegram_id] && (
                                    <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 p-2 rounded-xl">{payoutMsg[ref.telegram_id]}</p>
                                )}

                                {/* Payout history */}
                                {ref.payouts.length > 0 && (
                                    <details className="text-[10px]">
                                        <summary className="text-slate-500 cursor-pointer hover:text-slate-300 font-bold uppercase tracking-wider">История ({ref.payouts.length})</summary>
                                        <div className="mt-2 space-y-1 pl-2">
                                            {ref.payouts.map((p: any, i: number) => (
                                                <p key={i} className="text-slate-400 font-mono">{p.content.replace(PAYOUT_PREFIX, '').trim()}</p>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Manager Management */}
            <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]">manage_accounts</span>
                    {t.manageManagers || 'Управление Менеджерами'}
                </h3>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={newManagerId}
                        onChange={e => setNewManagerId(e.target.value)}
                        placeholder={t.enterTgId || 'Telegram ID менеджера'}
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/40 transition-all"
                    />
                    <button onClick={handleAddManager} className="px-5 py-3 bg-primary/20 text-primary border border-primary/30 rounded-xl text-sm font-bold hover:bg-primary/30 transition-all active:scale-95">
                        {t.assignEmployee || '+ Добавить'}
                    </button>
                </div>
                {managerMsg && <p className="text-xs text-primary/80 bg-primary/10 border border-primary/20 p-3 rounded-xl">{managerMsg}</p>}
                {managers.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.activeEmployees || 'Сотрудники'}</p>
                        {managers.map(m => (
                            <div key={m.telegram_id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                <div>
                                    <p className="text-sm font-bold text-slate-200">@{m.username || '—'}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{m.telegram_id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${m.role === 'founder' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'}`}>
                                        {m.role === 'founder' ? (t.ownerBadge || 'Владелец') : t.roleManager}
                                    </span>
                                    {m.role !== 'founder' && (
                                        <button onClick={() => handleRemoveManager(m.telegram_id)} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
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
