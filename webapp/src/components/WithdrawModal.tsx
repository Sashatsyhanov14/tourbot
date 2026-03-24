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
        alert(t.alert.replace('{amount}', amount).replace('{method}', method));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-[#1a191d] border border-white/5 rounded-t-2xl sm:rounded-2xl p-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 text-on-surface">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold font-headline">{t.title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-container-highest transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-surface-variant">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 font-body">
                    <div className="space-y-1">
                        <label className="text-sm text-on-surface-variant font-bold uppercase tracking-wide">{t.amountLabel.replace('{balance}', String(balance))}</label>
                        <input
                            type="number"
                            required
                            max={balance}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-3 flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary/50"
                            placeholder={t.amountPlaceholder}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-on-surface-variant font-bold uppercase tracking-wide">{t.methodLabel}</label>
                        <input
                            type="text"
                            required
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full p-3 flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary/50"
                            placeholder={t.methodPlaceholder}
                        />
                    </div>

                    <button type="submit" className="w-full py-4 text-sm uppercase tracking-widest font-bold bg-primary/20 text-primary border border-primary/30 rounded-xl shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 active:scale-95 transition-all">
                        {t.submit}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default WithdrawModal;
