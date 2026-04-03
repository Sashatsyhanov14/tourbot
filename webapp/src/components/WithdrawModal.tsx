import React, { useState } from 'react';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
    lang: 'ru' | 'tr';
}

const translations = {
    ru: {
        title: "Вывод бонусов",
        amountLabel: "Сумма (Макс: {balance} $)",
        amountPlaceholder: "0.00",
        methodLabel: "Способ выплаты (Карта / USDT / Номер)",
        methodPlaceholder: "Реквизиты...",
        submit: "Отправить запрос",
        alert: "Заявка на вывод {amount} $ ({method}) отправлена менеджеру!"
    },
    tr: {
        title: "Bonus Çekimi",
        amountLabel: "Tutar (Maks: {balance} $)",
        amountPlaceholder: "0.00",
        methodLabel: "Ödeme Yöntemi (Kart / USDT / Numara)",
        methodPlaceholder: "Hesap Bilgileri...",
        submit: "Talebi Gönder",
        alert: "Çekim talebi {amount} $ ({method}) yöneticiye gönderildi!"
    }
};

const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, balance, lang }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('');

    if (!isOpen) return null;

    const t = translations[lang];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.sendData(JSON.stringify({
                type: 'withdraw_request',
                amount: parseFloat(amount),
                method: method
            }));
            tg.showAlert(t.alert.replace('{amount}', amount).replace('{method}', method));
        } else {
            alert(t.alert.replace('{amount}', amount).replace('{method}', method));
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-sm bg-[#1a191d] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-500">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-white tracking-tight">{t.title}</h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10">
                        <span className="material-symbols-outlined text-slate-400">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] ml-1">{t.amountLabel.replace('{balance}', String(balance))}</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 text-[20px]">payments</span>
                            <input
                                type="number"
                                required
                                max={balance}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-2xl text-base font-bold text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-slate-700"
                                placeholder={t.amountPlaceholder}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] ml-1">{t.methodLabel}</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">account_balance_wallet</span>
                            <input
                                type="text"
                                required
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-2xl text-base font-bold text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-slate-700"
                                placeholder={t.methodPlaceholder}
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-5 text-xs uppercase tracking-[0.3em] font-black bg-primary text-black rounded-2xl shadow-[0_20px_40px_rgba(208,188,255,0.2)] hover:brightness-110 active:scale-[0.98] transition-all mt-4">
                        {t.submit}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default WithdrawModal;
