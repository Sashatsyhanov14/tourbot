import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AdminStats from './components/AdminStats';
import AdminExcursions from './components/AdminExcursions';
import AdminFaq from './components/AdminFaq';
import AdminRequests from './components/AdminRequests';
import WithdrawModal from './components/WithdrawModal';

declare global {
  interface Window {
    Telegram: any;
  }
}

const translations: any = {
  ru: {
    adminTitle: "Панель Управления",
    adminSubtitle: "Глобальная статистика",
    tabReferral: "Моя Рефералка",
    tabStats: "Дашборд",
    tabExcursions: "Экскурсии",
    tabRequests: "Заявки",
    tabFaq: "FAQ",
    loading: "Загрузка...",
    bonusBalance: "Ваш баланс",
    invitedCount: "Приглашено друзей",
    requestsCount: "Оформлено заявок",
    inviteTitle: "Ваша реферальная ссылка",
    promoLabel: "ПРОМОКОД",
    copyBtn: "Копировать",
    getQrBtn: "Получить QR в чат",
    loginTitle: "Вход в панель",
    loginDesc: "Введите ваш Telegram ID для доступа к управлению.",
    loginPlaceholder: "Ваш ID",
    loginBtn: "Войти",
    roleFounder: "Владелец",
    roleManager: "Менеджер",
    roleUser: "Клиент",
    statsTotalUsers: "Всего клиентов",
    statsTotalRequests: "Всего заявок",
    statsRevenue: "Ожидаемая выручка",
    linkCopied: "Скопировано!",
    withdrawBtn: "Вывести бонусы",
    manageFaq: "Управление FAQ",
    deleteFaqConfirm: "Удалить этот вопрос?",
    addFaq: "Добавить Вопрос",
    newFaq: "Новый FAQ",
    editFaq: "Редактировать FAQ",
    faqTopic: "Тема / Вопрос",
    faqContent: "Ответ...",
    saveBtn: "Сохранить",
    cancelBtn: "Отмена"
  },
  en: {
    adminTitle: "Admin Panel",
    adminSubtitle: "Global Statistics",
    tabReferral: "My Referral",
    tabStats: "Dashboard",
    tabExcursions: "Excursions",
    tabRequests: "Requests",
    tabFaq: "FAQ",
    loading: "Loading...",
    bonusBalance: "Your balance",
    invitedCount: "Invited friends",
    requestsCount: "Requests made",
    inviteTitle: "Your referral link",
    promoLabel: "PROMO CODE",
    copyBtn: "Copy",
    getQrBtn: "Get QR in chat",
    loginTitle: "Login",
    loginDesc: "Enter your Telegram ID to access the control panel.",
    loginPlaceholder: "Your ID",
    loginBtn: "Login",
    roleFounder: "Owner",
    roleManager: "Manager",
    roleUser: "Client",
    statsTotalUsers: "Total clients",
    statsTotalRequests: "Total requests",
    statsRevenue: "Expected revenue",
    linkCopied: "Copied!",
    withdrawBtn: "Withdraw bonuses",
    manageFaq: "Manage FAQ",
    deleteFaqConfirm: "Delete this question?",
    addFaq: "Add Question",
    newFaq: "New FAQ",
    editFaq: "Edit FAQ",
    faqTopic: "Topic / Question",
    faqContent: "Answer...",
    saveBtn: "Save",
    cancelBtn: "Cancel"
  },
  tr: {
    adminTitle: "Yönetim Paneli",
    adminSubtitle: "Küresel İstatistikler",
    tabReferral: "Referansım",
    tabStats: "Panel",
    tabExcursions: "Turlar",
    tabRequests: "Başvurular",
    tabFaq: "SSS",
    loading: "Yükleniyor...",
    bonusBalance: "Bakiyeniz",
    invitedCount: "Davet edilenler",
    requestsCount: "Toplam başvuru",
    inviteTitle: "Davet linkiniz",
    promoLabel: "PROMOSYON",
    copyBtn: "Kopyala",
    getQrBtn: "QR Kodu Al",
    loginTitle: "Giriş",
    loginDesc: "Yönetim paneline erişmek için Telegram ID'nizi girin.",
    loginPlaceholder: "ID'niz",
    loginBtn: "Giriş Yap",
    roleFounder: "Sahibi",
    roleManager: "Yönetici",
    roleUser: "Müşteri",
    statsTotalUsers: "Toplam müşteri",
    statsTotalRequests: "Toplam başvuru",
    statsRevenue: "Beklenen gelir",
    linkCopied: "Kopyalandı!",
    withdrawBtn: "Bonus Çek",
    manageFaq: "SSS Yönetimi",
    deleteFaqConfirm: "Bu soruyu silmek istediğinize emin misiniz?",
    addFaq: "Soru Ekle",
    newFaq: "Yeni SSS",
    editFaq: "SSS Düzenle",
    faqTopic: "Konu / Soru",
    faqContent: "Cevap...",
    saveBtn: "Kaydet",
    cancelBtn: "İptal"
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loginInputId, setLoginInputId] = useState('');
  const [lang, setLang] = useState<'ru' | 'en' | 'tr'>('ru');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'referral' | 'stats' | 'excursions' | 'requests' | 'faq'>('referral');
  const [referralStats, setReferralStats] = useState({ invited: 0, requests: 0 });
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    const init = async () => {
      if (tg) {
        tg.ready();
        tg.expand();
      }

      // Пробуем получить данные пользователя разными способами
      let tgUser: any = null;

      // Способ 1: initDataUnsafe (прямой объект)
      for (let i = 0; i < 5; i++) {
        tgUser = tg?.initDataUnsafe?.user;
        if (tgUser?.id) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Способ 2: парсим сырой initData вручную (работает на Telegram Desktop)
      if (!tgUser?.id && tg?.initData) {
        try {
          const params = new URLSearchParams(tg.initData);
          const userStr = params.get('user');
          if (userStr) {
            tgUser = JSON.parse(decodeURIComponent(userStr));
          }
        } catch (e) { /* ignore */ }
      }

      if (tgUser?.id) {
        const userLang = tgUser.language_code === 'tr' ? 'tr' : (tgUser.language_code === 'ru' ? 'ru' : 'en');
        setLang(userLang);
        await fetchUserData(tgUser.id, tgUser.first_name, tgUser.username);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const t = translations[lang] || translations.en;

  const fetchUserData = async (tgId: number, firstName?: string, username?: string) => {
    try {
      setLoading(true);
      const { data: userData, error } = await supabase.from('users').select('*').eq('telegram_id', tgId).single();

      let currentUser = userData;

      if (!userData && error && tg?.initDataUnsafe?.user) {
        // Если пользователя нет, но мы в Telegram — создаем его
        const newUser = {
          telegram_id: tgId,
          first_name: firstName || 'User',
          username: username || '',
          balance: 0,
          role: 'client'
        };
        const { data: created } = await supabase.from('users').insert(newUser).select().single();
        if (created) currentUser = created;
      }

      if (currentUser) {
        setUser(currentUser);
        if (currentUser.role === 'founder' || currentUser.role === 'manager') {
          setActiveTab('stats');
        }

        const { count: invitedCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referrer_id', tgId);
        const { count: reqCount } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('user_id', tgId);

        setReferralStats({ invited: invitedCount || 0, requests: reqCount || 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = () => {
    if (loginInputId) fetchUserData(parseInt(loginInputId));
  };

  const handleSendQr = async () => {
    if (!user) return;
    tg?.showAlert("QR-код отправлен в чат!");
    tg?.close();
  };

  if (loading) return <div className="text-center mt-20 text-slate-400 font-medium animate-pulse">{t.loading}</div>;

  if (!user) {
    return (
      <div className="bg-[#0f0f11] min-h-screen flex items-center justify-center p-6 text-slate-200">
        <div className="glass-card p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl border border-white/5">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold">{t.loginTitle}</h1>
            <p className="text-sm text-slate-400">{t.loginDesc}</p>
          </div>
          <input
            type="number"
            value={loginInputId}
            onChange={(e) => setLoginInputId(e.target.value)}
            placeholder={t.loginPlaceholder}
            className="w-full bg-[#1a1a1d] border border-white/10 rounded-2xl p-4 text-center text-lg focus:border-primary/50 outline-none"
          />
          <button
            onClick={handleManualLogin}
            className="w-full bg-primary/20 text-primary border border-primary/30 py-4 rounded-2xl font-bold hover:bg-primary/30 transition-all active:scale-95"
          >
            {t.loginBtn}
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user.role === 'founder' || user.role === 'manager';
  const refLink = `https://t.me/your_bot_username?start=${user.telegram_id}`;

  const renderContent = () => {
    switch (activeTab) {
      case 'referral':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-secondary/20 to-transparent p-6 rounded-3xl border border-white/5 text-center">
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">{t.bonusBalance}</span>
              <h2 className="text-5xl font-black mt-2 text-white">${user.balance?.toFixed(2) || '0.00'}</h2>
              <button
                onClick={() => setIsWithdrawOpen(true)}
                className="mt-4 px-6 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                {t.withdrawBtn}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.invitedCount}</p>
                <p className="text-3xl font-bold text-slate-100">{referralStats.invited}</p>
              </div>
              <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.requestsCount}</p>
                <p className="text-3xl font-bold text-slate-100">{referralStats.requests}</p>
              </div>
            </div>

            <div className="bg-[#1a1a1d] p-6 rounded-3xl border border-primary/20 space-y-4">
              <h3 className="font-bold text-slate-200">{t.inviteTitle}</h3>
              <div className="flex gap-2 bg-black/30 p-2 rounded-2xl border border-white/5">
                <input readOnly value={refLink} className="flex-1 bg-transparent px-3 text-sm font-mono text-primary outline-none min-w-0" />
                <button onClick={() => { navigator.clipboard.writeText(refLink); tg?.showAlert(t.linkCopied); }} className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-xs font-bold whitespace-nowrap">{t.copyBtn}</button>
              </div>
              <div className="bg-white p-4 rounded-2xl w-fit mx-auto shadow-xl">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(refLink)}`} alt="QR" className="block" />
              </div>
              <button onClick={handleSendQr} className="w-full py-4 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-bold text-sm active:scale-95 transition-all">{t.getQrBtn}</button>
            </div>
          </div>
        );
      case 'stats': return <AdminStats t={t} />;
      case 'excursions': return <AdminExcursions t={t} />;
      case 'requests': return <AdminRequests t={t} />;
      case 'faq': return <AdminFaq t={t} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-slate-100 font-sans pb-32">
      <header className="px-6 pt-12 pb-6 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">{activeTab === 'referral' ? t.tabReferral : t.adminSubtitle}</p>
          <h1 className="text-2xl font-bold">{activeTab === 'referral' ? t.adminTitle.replace('Управления', 'Профиля') : t.adminTitle}</h1>
        </div>
        <div className="flex gap-2 bg-[#1a1a1d] p-1 rounded-full border border-white/5">
          {['ru', 'en', 'tr'].map(l => (
            <button key={l} onClick={() => setLang(l as any)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${lang === l ? 'bg-primary text-black' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </header>

      <main className="px-6 max-w-4xl mx-auto">{renderContent()}</main>

      <nav className="fixed bottom-6 left-6 right-6 z-50 flex justify-around items-center p-2 bg-[#1a1a1d]/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl">
        <button onClick={() => setActiveTab('referral')} className={`flex flex-col items-center p-4 rounded-3xl transition-all ${activeTab === 'referral' ? 'text-primary' : 'text-slate-500'}`}>
          <span className="material-symbols-outlined mb-1">group</span>
          <span className="text-[9px] font-bold uppercase tracking-wider">{t.tabReferral.split(' ')[1] || t.tabReferral}</span>
        </button>
        {isOwner && (
          <>
            <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center p-4 rounded-3xl transition-all ${activeTab === 'stats' ? 'text-primary' : 'text-slate-500'}`}>
              <span className="material-symbols-outlined mb-1">dashboard</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">{t.tabStats}</span>
            </button>
            <button onClick={() => setActiveTab('excursions')} className={`flex flex-col items-center p-4 rounded-3xl transition-all ${activeTab === 'excursions' ? 'text-primary' : 'text-slate-500'}`}>
              <span className="material-symbols-outlined mb-1">map</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">{t.tabExcursions}</span>
            </button>
            <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center p-4 rounded-3xl transition-all ${activeTab === 'requests' ? 'text-primary' : 'text-slate-500'}`}>
              <span className="material-symbols-outlined mb-1">list_alt</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">{t.tabRequests}</span>
            </button>
          </>
        )}
      </nav>

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={user.balance || 0}
        lang={lang === 'en' ? 'ru' : lang as any} // Fallback to ru for tr/en if needed, or update modal
      />
    </div>
  );
};

export default App;
