import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PAYOUT_PREFIX = 'PAYOUT_RECORD:';

const AdminStats: React.FC<{ t: any }> = ({ t }) => {
    const [stats, setStats] = useState({ totalUsers: 0, totalRequests: 0, newRequests: 0, totalRevenue: 0 });
    const [referralRows, setReferralRows] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [newManagerId, setNewManagerId] = useState('');
    const [newManagerNote, setNewManagerNote] = useState('');
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
        // 1. Get all users who have been referred (have referrer_id set)
        const { data: invitedUsers } = await supabase
            .from('users')
            .select('telegram_id, username, referrer_id')
            .not('referrer_id', 'is', null);

        if (!invitedUsers || invitedUsers.length === 0) return;

        // 2. Get unique referrer IDs
        const referrerIds = [...new Set(invitedUsers.map((u: any) => u.referrer_id))];

        // 3. Fetch referrer profiles
        const { data: referrers } = await supabase
            .from('users')
            .select('telegram_id, username, balance, note')
            .in('telegram_id', referrerIds);

        if (!referrers) return;

        // 4. Fetch all payout history for these referrers in one query
        const { data: allPayouts } = await supabase
            .from('chat_history')
            .select('user_id, content, created_at')
            .in('user_id', referrerIds)
            .like('content', `${PAYOUT_PREFIX}%`)
            .order('created_at', { ascending: false });

        // 5. Fetch all requests from invitees in one query (with full details)
        const inviteeIds = invitedUsers.map((u: any) => u.telegram_id);
        const { data: allReqs } = await supabase
            .from('requests')
            .select('user_id, price_rub, status, excursion_title, tour_date, full_name, created_at')
            .in('user_id', inviteeIds)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

        // 6. Build rows
        const rows = referrers.map((ref: any) => {
            const myInvitees = invitedUsers.filter((u: any) => u.referrer_id === ref.telegram_id);
            const myInviteeIds = myInvitees.map((u: any) => u.telegram_id);
            const myReqs = (allReqs || []).filter((r: any) => myInviteeIds.includes(r.user_id));
            const revenue = myReqs.reduce((sum: number, r: any) => sum + (Number(r.price_rub) || 0), 0);
            const myPayouts = (allPayouts || []).filter((p: any) => p.user_id === ref.telegram_id);
            const totalPaid = myPayouts.reduce((sum: number, p: any) => {
                const match = p.content.match(/\$?([\d.]+)/);
                return sum + (match ? parseFloat(match[1]) : 0);
            }, 0);

            return {
                telegram_id: ref.telegram_id,
                username: ref.username,
                balance: ref.balance || 0,
                invitedCount: myInvitees.length,
                requestCount: myReqs.length,
                revenue,
                totalPaid,
                note: ref.note || '',
                payouts: myPayouts,
                requests: myReqs  // full request objects
            };
        });

        setReferralRows(rows);
    };

    const fetchManagers = async () => {
        const { data } = await supabase.from('users').select('telegram_id, username, role, note').in('role', ['manager', 'founder']);
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
        await supabase.from('users').update({ role: 'manager', note: newManagerNote }).eq('telegram_id', id);
        setManagerMsg((t.managerAddSuccess || '✅ ID {id} теперь Менеджер.').replace('{id}', String(id)));
        setNewManagerId('');
        setNewManagerNote('');
        fetchManagers();
    };

    const handleUpdateNote = async (tgId: number, newNote: string) => {
        await supabase.from('users').update({ note: newNote }).eq('telegram_id', tgId);
        fetchAll();
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
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-primary/20">
                                        <span className="material-symbols-outlined text-primary text-[24px]">person</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <p className="text-base font-black text-white truncate">@{ref.username}</p>
                                            <span className="bg-white/5 text-[9px] font-mono text-slate-500 px-2 py-0.5 rounded-md border border-white/5">{ref.telegram_id}</span>
                                        </div>
                                        {/* Premium Tag Input */}
                                        <div className="relative group max-w-[200px]">
                                            <div className="absolute inset-y-0 left-0 w-1 bg-primary rounded-full opacity-0 group-focus-within:opacity-100 transition-all blur-[2px]" />
                                            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5 hover:bg-primary/10 transition-all">
                                                <span className="material-symbols-outlined text-[14px] text-primary/60">label</span>
                                                <input 
                                                    className="text-[11px] font-bold text-primary bg-transparent border-none outline-none w-full placeholder:text-primary/30"
                                                    placeholder="Подпись партнёра..."
                                                    defaultValue={ref.note}
                                                    onBlur={(e) => handleUpdateNote(ref.telegram_id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-primary tracking-tighter">${ref.balance}</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">баланс</p>
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

                                {/* Bookings from this referral's invitees */}
                                {ref.requests && ref.requests.length > 0 && (
                                    <details className="text-[10px]">
                                        <summary className="text-slate-400 cursor-pointer hover:text-slate-200 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                            Заявки ({ref.requests.length})
                                        </summary>
                                        <div className="mt-2 space-y-1.5 pl-2">
                                            {ref.requests.map((r: any, i: number) => (
                                                <div key={i} className="bg-black/30 p-2 rounded-xl flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-slate-200 font-bold truncate">{r.excursion_title || '—'}</p>
                                                        <p className="text-slate-500">{r.full_name || '—'} · {r.tour_date || '—'}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-primary font-black">${r.price_rub || 0}</p>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.status === 'accepted' ? 'bg-green-500/20 text-green-400' : r.status === 'new' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                                                            {r.status === 'accepted' ? '✓' : r.status === 'new' ? 'новая' : r.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                {/* Payout history */}
                                {ref.payouts.length > 0 && (
                                    <details className="text-[10px]">
                                        <summary className="text-slate-500 cursor-pointer hover:text-slate-300 font-bold uppercase tracking-wider">История выплат ({ref.payouts.length})</summary>
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
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">fingerprint</span>
                            <input
                                type="number"
                                value={newManagerId}
                                onChange={e => setNewManagerId(e.target.value)}
                                placeholder={t.enterTgId || 'Telegram ID'}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <button onClick={handleAddManager} className="px-6 py-4 bg-primary text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-95 flex items-center gap-2">
                            {t.assignEmployee || 'Добавить'}
                        </button>
                    </div>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">edit_note</span>
                        <input
                            type="text"
                            value={newManagerNote}
                            onChange={e => setNewManagerNote(e.target.value)}
                            placeholder="Личная заметка к сотруднику (подпись)..."
                            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-secondary/50 transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>
                {managerMsg && <p className="text-xs text-primary/80 bg-primary/10 border border-primary/20 p-3 rounded-xl">{managerMsg}</p>}
                {managers.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.activeEmployees || 'Сотрудники'}</p>
                        {managers.map(m => (
                            <div key={m.telegram_id} className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5 transition-all hover:bg-white/[0.04]">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <p className="text-sm font-black text-slate-200">@{m.username || '—'}</p>
                                        <span className="bg-white/5 text-[8px] font-mono text-slate-600 px-1.5 py-0.5 rounded border border-white/5">{m.telegram_id}</span>
                                    </div>
                                    <div className="relative group max-w-[200px]">
                                        <div className="absolute inset-y-0 left-0 w-0.5 bg-secondary rounded-full opacity-0 group-focus-within:opacity-100 transition-all blur-[1px]" />
                                        <div className="flex items-center gap-2 bg-secondary/5 border border-secondary/20 rounded-xl px-3 py-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-secondary/60">badge</span>
                                            <input 
                                                className="text-[11px] font-bold text-secondary bg-transparent border-none outline-none w-full placeholder:text-secondary/30"
                                                placeholder="Подпись менеджера..."
                                                defaultValue={m.note}
                                                onBlur={(e) => handleUpdateNote(m.telegram_id, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {m.role === 'founder' && (
                                        <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                            {t.ownerBadge || 'Владелец'}
                                        </span>
                                    )}
                                    {m.role !== 'founder' && (
                                        <button onClick={() => handleRemoveManager(m.telegram_id)} className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center border border-red-500/20">
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
