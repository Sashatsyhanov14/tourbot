import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PAYOUT_PREFIX = 'PAYOUT_RECORD:';

const AdminStats: React.FC<{ t: any, isAdmin?: boolean, user?: any }> = ({ t, isAdmin, user }) => {
    const [stats, setStats] = useState({ totalUsers: 0, totalRequests: 0, newRequests: 0, totalRevenue: 0 });
    const [referralRows, setReferralRows] = useState<any[]>([]);
    
    const isOnlyManager = user?.role === 'manager';
    const [managers, setManagers] = useState<any[]>([]);
    const [newManagerId, setNewManagerId] = useState('');
    const [newManagerRole, setNewManagerRole] = useState<'manager' | 'admin'>('manager');
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
        const { data: allReqs, count: rCount } = await supabase.from('requests').select('*, users(referrer_id)');
        if (allReqs) {
            const filteredReqs = allReqs;
            const newReqs = filteredReqs.filter((r: any) => r.status === 'new').length;
            const revenue = filteredReqs.filter((r: any) => r.status !== 'cancelled').reduce((acc: number, curr: any) => acc + (Number(curr.price_usd) || 0), 0);
            
            setStats({ 
                totalUsers: uCount || 0, 
                totalRequests: rCount || 0, 
                newRequests: newReqs, 
                totalRevenue: revenue 
            });
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
            .select('user_id, price_usd, status, excursion_title, tour_date, full_name, created_at')
            .in('user_id', inviteeIds)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

        // 6. Build rows
        const rows = referrers.map((ref: any) => {
            const myInvitees = invitedUsers.filter((u: any) => u.referrer_id === ref.telegram_id);
            const myInviteeIds = myInvitees.map((u: any) => u.telegram_id);
            const myReqs = (allReqs || []).filter((r: any) => myInviteeIds.includes(r.user_id));
            const revenue = myReqs.reduce((sum: number, r: any) => sum + (Number(r.price_usd) || 0), 0);
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

        const finalRows = isOnlyManager ? rows.filter((r: any) => String(r.telegram_id) === String(user.telegram_id)) : rows;
        setReferralRows(finalRows);
    };

    const fetchManagers = async () => {
        const { data } = await supabase.from('users').select('telegram_id, username, role, note').in('role', ['manager', 'admin', 'founder']);
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
        if (!newManagerId || !isAdmin) return;
        
        let query = supabase.from('users').select('*');
        const input = newManagerId.trim();
        
        if (/^\d+$/.test(input)) {
            query = query.eq('telegram_id', parseInt(input));
        } else {
            const username = input.startsWith('@') ? input.substring(1) : input;
            query = query.eq('username', username);
        }

        const { data: existingUser } = await query.single();
        
        if (!existingUser) {
            setManagerMsg(t.managerAddError || '❌ Пользователь не найден.');
            return;
        }

        await supabase.from('users').update({ role: newManagerRole, note: newManagerNote }).eq('telegram_id', existingUser.telegram_id);
        
        const roleName = newManagerRole === 'admin' ? 'Admin' : (t.roleManager || 'Manager');
        setManagerMsg(`✅ ${existingUser.username || existingUser.telegram_id} теперь ${roleName}.`);
        setNewManagerId('');
        setNewManagerNote('');
        fetchManagers();
    };

    const handleUpdateNote = async (tgId: number, newNote: string) => {
        await supabase.from('users').update({ note: newNote }).eq('telegram_id', tgId);
        fetchManagers();
    };

    const handleUpdateRole = async (tgId: number, newRole: 'manager' | 'admin') => {
        await supabase.from('users').update({ role: newRole }).eq('telegram_id', tgId);
        setManagerMsg(`✅ Роль обновлена.`);
        fetchManagers();
    };

    const handleRemoveManager = async (id: number) => {
        await supabase.from('users').update({ role: 'user' }).eq('telegram_id', id);
        setManagerMsg((t.managerRemoveSuccess || '🗑️ Сотрудник {id} удалён.').replace('{id}', String(id)));
        fetchManagers();
    };

    if (loading) return <div className="text-center py-20 opacity-50 animate-pulse">{t.analyzing || 'Анализ данных...'}</div>;

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── SECTION 1: Stats Cards ── */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5 flex flex-col gap-1">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">group</span>
                    <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.statsTotalUsers}</p>
                </div>
                <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5 flex flex-col gap-1">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">list_alt</span>
                    <p className="text-3xl font-black text-white">{stats.totalRequests}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.statsTotalRequests}</p>
                </div>
                <div className="bg-primary/10 p-5 rounded-3xl border border-primary/20 col-span-2 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{t.statsRevenue}</p>
                        <p className="text-4xl font-black text-white">${stats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[40px] opacity-30">payments</span>
                </div>
            </div>

            {/* ── SECTION 2: New Requests Alert ── */}
            {stats.newRequests > 0 && (
                <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-400">notifications_active</span>
                        <p className="text-xs font-bold text-blue-100 uppercase tracking-wide">Новых заявок ожидает</p>
                    </div>
                    <span className="bg-blue-500 text-black text-[10px] font-black px-3 py-1 rounded-full">{stats.newRequests}</span>
                </div>
            )}

            {/* ── SECTION 3: Referral Analytics + Payouts ── */}
            {referralRows.length > 0 && (
                <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                            <h3 className="text-sm font-bold text-slate-200">Реферальная аналитика</h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{referralRows.length} партнёров</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {referralRows.map(ref => (
                            <div key={ref.telegram_id} className="p-3 hover:bg-white/[0.01] transition-all">
                                {/* Compact Row: User info + Balance + Payout button */}
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 border border-primary/20">
                                        <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-black text-white truncate">@{ref.username}</p>
                                            <span className="text-[8px] font-mono text-slate-600">ID: {ref.telegram_id}</span>
                                        </div>
                                        <input
                                            className="text-[9px] font-bold text-primary/60 bg-transparent border-none outline-none w-full placeholder:text-primary/20 hover:text-primary/100 transition-all"
                                            placeholder="Добавить подпись..."
                                            defaultValue={ref.note}
                                            onBlur={(e) => handleUpdateNote(ref.telegram_id, e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <p className="text-sm font-black text-primary">${ref.balance}</p>
                                        </div>
                                        <button
                                            onClick={() => handlePayout(ref)}
                                            disabled={ref.balance <= 0}
                                            className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-20"
                                        >
                                            ВЫПЛАТИТЬ
                                        </button>
                                    </div>
                                </div>

                                {/* Compact Stats Sub-row */}
                                <div className="mt-2 flex items-center gap-4 pl-11">
                                    <div className="flex items-center gap-1">
                                        <p className="text-[10px] font-black text-blue-400">{ref.invitedCount}</p>
                                        <p className="text-[8px] text-slate-600 uppercase">привёл</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <p className="text-[10px] font-black text-green-400">{ref.requestCount}</p>
                                        <p className="text-[8px] text-slate-600 uppercase">заявок</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <p className="text-[10px] font-black text-primary">${ref.revenue}</p>
                                        <p className="text-[8px] text-slate-600 uppercase">оборот</p>
                                    </div>
                                    {ref.totalPaid > 0 && (
                                        <div className="ml-auto text-[8px] text-slate-600 uppercase flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[10px]">check_circle</span>
                                            Выплачено: <span className="text-slate-400 font-bold">${ref.totalPaid.toFixed(0)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Compact Details Alerts/Expanders */}
                                <div className="mt-2 pl-11 flex gap-2">
                                    {ref.requests && ref.requests.length > 0 && (
                                        <details className="text-[8px]">
                                            <summary className="text-slate-500 cursor-pointer hover:text-slate-300 font-bold uppercase tracking-widest flex items-center gap-1 outline-none">
                                                Заявки ({ref.requests.length})
                                            </summary>
                                            <div className="mt-1 space-y-1">
                                                {ref.requests.slice(0, 5).map((r: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 opacity-80">
                                                        <span className="truncate max-w-[120px]">{r.excursion_title}</span>
                                                        <span className="text-primary font-bold">${r.price_usd}</span>
                                                    </div>
                                                ))}
                                                {ref.requests.length > 5 && <p className="text-slate-600">...и ещё {ref.requests.length - 5}</p>}
                                            </div>
                                        </details>
                                    )}
                                    {ref.payouts.length > 0 && (
                                        <details className="text-[8px]">
                                            <summary className="text-slate-600 cursor-pointer hover:text-slate-400 font-bold uppercase tracking-widest outline-none">История</summary>
                                            <div className="mt-1 opacity-60 italic">
                                                {ref.payouts.map((p: any, i: number) => (
                                                    <p key={i}>{p.content.replace(PAYOUT_PREFIX, '').trim()}</p>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                    {payoutMsg[ref.telegram_id] && (
                                        <span className="text-green-500 font-bold uppercase tracking-tighter animate-pulse">{payoutMsg[ref.telegram_id]}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── SECTION 4: Staff Management (Admin only, at bottom) ── */}
            {isAdmin && (
                <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-[18px]">manage_accounts</span>
                        <h3 className="text-sm font-bold text-slate-200">{t.manageManagers || 'Управление сотрудниками'}</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Staff list */}
                        {managers.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.activeEmployees || 'Сотрудники'}</p>
                                {managers.map(m => (
                                    <div key={m.telegram_id} className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5 transition-all hover:bg-white/[0.04]">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="text-sm font-black text-slate-200">@{m.username || '—'}</p>
                                                <span className="bg-white/5 text-[8px] font-mono text-slate-600 px-1.5 py-0.5 rounded border border-white/5">{m.telegram_id}</span>
                                            </div>
                                            <div className="relative group max-w-[200px]">
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
                                        <div className="flex items-center gap-2">
                                            {m.role === 'founder' ? (
                                                <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                    {t.ownerBadge || 'Владелец'}
                                                </span>
                                            ) : (
                                                <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/5">
                                                    <button onClick={() => handleUpdateRole(m.telegram_id, 'manager')} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${m.role === 'manager' ? 'bg-secondary text-black' : 'text-slate-500 hover:text-white'}`}>M</button>
                                                    <button onClick={() => handleUpdateRole(m.telegram_id, 'admin')} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${m.role === 'admin' ? 'bg-primary text-black' : 'text-slate-500 hover:text-white'}`}>A</button>
                                                </div>
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

                        {/* Add staff form */}
                        <div className="space-y-3 pt-3 border-t border-white/5">
                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">fingerprint</span>
                                    <input
                                        type="text"
                                        value={newManagerId}
                                        onChange={e => setNewManagerId(e.target.value)}
                                        placeholder={t.enterTgId || 'Telegram ID или @username'}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all placeholder:text-slate-600"
                                    />
                                </div>
                                <button onClick={handleAddManager} className="px-6 py-4 bg-primary text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-95">
                                    {t.assignEmployee || '+ Добавить'}
                                </button>
                            </div>
                            <div className="flex items-center gap-4 bg-black/20 p-2 px-3 rounded-xl border border-white/5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Роль:</span>
                                <div className="flex gap-2 flex-1">
                                    <button onClick={() => setNewManagerRole('manager')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${newManagerRole === 'manager' ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-white/5 text-slate-500'}`}>
                                        Manager
                                    </button>
                                    <button onClick={() => setNewManagerRole('admin')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${newManagerRole === 'admin' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-slate-500'}`}>
                                        Admin
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">edit_note</span>
                                <input
                                    type="text"
                                    value={newManagerNote}
                                    onChange={e => setNewManagerNote(e.target.value)}
                                    placeholder="Заметка (подпись сотрудника)..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-secondary/50 transition-all placeholder:text-slate-600"
                                />
                            </div>
                            {managerMsg && <p className="text-xs text-primary/80 bg-primary/10 border border-primary/20 p-3 rounded-xl">{managerMsg}</p>}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AdminStats;
