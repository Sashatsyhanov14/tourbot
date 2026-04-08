import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AdminStats from './components/AdminStats';
import AdminExcursions from './components/AdminExcursions';
import AdminFaq from './components/AdminFaq';
import AdminRequests from './components/AdminRequests';
import WithdrawModal from './components/WithdrawModal';
import PublicCatalog from './components/PublicCatalog';

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
    tabCatalog: "Каталог",
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
    ownerBadge: "Основатель",
    statsTotalUsers: "Всего клиентов",
    statsTotalRequests: "Всего заявок",
    statsRevenue: "Ожидаемая выручка",
    linkCopied: "Скопировано!",
    withdrawBtn: "Вывести бонусы",
    manageManagers: "Управление Менеджерами",
    assignEmployee: "+ Добавить",
    enterTgId: "Telegram ID нового менеджера",
    activeEmployees: "Действующие сотрудники",
    managerAddError: "❌ Пользователь не найден. Пусть сначала нажмёт /start в боте.",
    managerAddSuccess: "✅ ID {id} теперь Менеджер.",
    managerRemoveSuccess: "🗑️ Сотрудник {id} удалён.",
    managerAddFail: "❌ Ошибка добавления.",
    analyzing: "Анализ данных...",
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
    tabCatalog: "Catalog",
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
    ownerBadge: "Founder",
    statsTotalUsers: "Total clients",
    statsTotalRequests: "Total requests",
    statsRevenue: "Expected revenue",
    linkCopied: "Copied!",
    withdrawBtn: "Withdraw bonuses",
    manageManagers: "Manage Managers",
    assignEmployee: "+ Add",
    enterTgId: "New manager's Telegram ID",
    activeEmployees: "Active staff",
    managerAddError: "❌ User not found. Ask them to press /start first.",
    managerAddSuccess: "✅ ID {id} is now a Manager.",
    managerRemoveSuccess: "🗑️ Staff {id} removed.",
    managerAddFail: "❌ Error adding.",
    analyzing: "Analyzing...",
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
    tabExcursions: "Geziler",
    tabRequests: "Talepler",
    tabFaq: "SSS",
    tabCatalog: "Katalog",
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
    ownerBadge: "Kurucu",
    statsTotalUsers: "Toplam müşteri",
    statsTotalRequests: "Toplam başvuru",
    statsRevenue: "Beklenen gelir",
    linkCopied: "Kopyalandı!",
    withdrawBtn: "Bonus Çek",
    manageManagers: "Yönetici Yönetimi",
    assignEmployee: "+ Ekle",
    enterTgId: "Yeni yöneticinin Telegram ID'si",
    activeEmployees: "Aktif çalışanlar",
    managerAddError: "❌ Kullanıcı bulunamadı. Önce /start'a bassın.",
    managerAddSuccess: "✅ ID {id} artık Yönetici.",
    managerRemoveSuccess: "🗑️ Çalışan {id} kaldırıldı.",
    managerAddFail: "❌ Ekleme hatası.",
    analyzing: "Analiz ediliyor...",
    manageFaq: "SSS Yönetimi",
    deleteFaqConfirm: "Bu soruyu silmek istediğinize emin misiniz?",
    addFaq: "Soru Ekle",
    newFaq: "Yeni SSS",
    editFaq: "SSS Düzenle",
    faqTopic: "Konu / Soru",
    faqContent: "Cevap...",
    saveBtn: "Kaydet",
    cancelBtn: "İptal"
  },
  de: {
    adminTitle: "Admin-Bereich", adminSubtitle: "Globale Statistiken", tabReferral: "Empfehlung", tabStats: "Dashboard", tabExcursions: "Ausflüge", tabRequests: "Anfragen", tabFaq: "FAQ", tabCatalog: "Katalog", loading: "Laden...", bonusBalance: "Ihr Guthaben", invitedCount: "Eingeladene Freunde", requestsCount: "Anfragen gestellt", inviteTitle: "Ihr Empfehlungslink", promoLabel: "PROMO-CODE", copyBtn: "Kopieren", getQrBtn: "QR im Chat", loginTitle: "Anmeldung", loginDesc: "Geben Sie Ihre Telegram-ID ein.", loginPlaceholder: "Ihre ID", loginBtn: "Anmelden", roleFounder: "Besitzer", roleManager: "Manager", roleUser: "Kunde", ownerBadge: "Gründer", statsTotalUsers: "Gesamt Kunden", statsTotalRequests: "Gesamt Anfragen", statsRevenue: "Erwarteter Umsatz", linkCopied: "Kopiert!", withdrawBtn: "Bonus abheben", manageManagers: "Manager verwalten", assignEmployee: "+ Hinzufügen", enterTgId: "Telegram-ID", activeEmployees: "Aktives Personal", managerAddError: "❌ Nicht gefunden. Bitte /start drücken.", managerAddSuccess: "✅ ID {id} ist jetzt Manager.", managerRemoveSuccess: "🗑️ ID {id} entfernt.", managerAddFail: "❌ Fehler.", analyzing: "Analysieren...", manageFaq: "FAQ verwalten", deleteFaqConfirm: "Löschen?", addFaq: "Hinzufügen", newFaq: "Neu", editFaq: "Bearbeiten", faqTopic: "Thema", faqContent: "Inhalt", saveBtn: "Speichern", cancelBtn: "Abbrechen"
  },
  pl: {
    adminTitle: "Panel Admina", adminSubtitle: "Statystyki globalne", tabReferral: "Polecenia", tabStats: "Pulpit", tabExcursions: "Wycieczki", tabRequests: "Zlecenia", tabFaq: "FAQ", tabCatalog: "Katalog", loading: "Ładowanie...", bonusBalance: "Twoje saldo", invitedCount: "Zaproszeni", requestsCount: "Złożone wnioski", inviteTitle: "Twój link polecający", promoLabel: "KOD PROMO", copyBtn: "Kopiuj", getQrBtn: "QR w czacie", loginTitle: "Logowanie", loginDesc: "Wpisz swój Telegram ID.", loginPlaceholder: "Twój ID", loginBtn: "Zaloguj", roleFounder: "Właściciel", roleManager: "Menedżer", roleUser: "Klient", ownerBadge: "Założyciel", statsTotalUsers: "Suma klientów", statsTotalRequests: "Suma wniosków", statsRevenue: "Przychód", linkCopied: "Skopiowano!", withdrawBtn: "Wypłać bonusy", manageManagers: "Zarządzaj kadrami", assignEmployee: "+ Dodaj", enterTgId: "Telegram ID", activeEmployees: "Aktywni", managerAddError: "❌ Nie znaleziono.", managerAddSuccess: "✅ ID {id} jest menedżerem.", managerRemoveSuccess: "🗑️ Usunięto {id}.", managerAddFail: "❌ Błąd.", analyzing: "Analiza...", manageFaq: "Zarządzaj FAQ", deleteFaqConfirm: "Usunąć?", addFaq: "Dodaj", newFaq: "Nowy", editFaq: "Edytuj", faqTopic: "Temat", faqContent: "Treść", saveBtn: "Zapisz", cancelBtn: "Anuluj"
  },
  ar: {
    adminTitle: "لوحة التحكم", adminSubtitle: "الإحصائيات العامة", tabReferral: "الإحالات", tabStats: "لوحة القيادة", tabExcursions: "الجولات", tabRequests: "الطلبات", tabFaq: "الأسئلة الشائعة", tabCatalog: "الكتالوج", loading: "جاري التحميل...", bonusBalance: "رصيدك", invitedCount: "الأصدقاء المدعوون", requestsCount: "الطلبات المقدمة", inviteTitle: "رابط الإحالة الخاص بك", promoLabel: "كود الخصم", copyBtn: "نسخ", getQrBtn: "احصل على QR", loginTitle: "تسجيل الدخول", loginDesc: "أدخل معرف تليجرام الخاص بك.", loginPlaceholder: "معرفك", loginBtn: "دخول", roleFounder: "المالك", roleManager: "مدير", roleUser: "عميل", ownerBadge: "مؤسس", statsTotalUsers: "إجمالي العملاء", statsTotalRequests: "إجمالي الطلبات", statsRevenue: "الإيرادات المتوقعة", linkCopied: "تم النسخ!", withdrawBtn: "سحب المكافآت", manageManagers: "إدارة المديرين", assignEmployee: "+ إضافة", enterTgId: "معرف تليجرام", activeEmployees: "الموظفون النشطون", managerAddError: "❌ لم يتم العثور عليه.", managerAddSuccess: "✅ أصبح المعرف {id} مديراً.", managerRemoveSuccess: "🗑️ تم إزالة الموظف {id}.", managerAddFail: "❌ خطأ.", analyzing: "جاري التحليل...", manageFaq: "إدارة الأسئلة", deleteFaqConfirm: "هل تريد الحذف؟", addFaq: "إضافة سؤال", newFaq: "سؤال جديد", editFaq: "تعديل", faqTopic: "الموضوع", faqContent: "المحتوى", saveBtn: "حفظ", cancelBtn: "إلغاء"
  },
  fa: {
    adminTitle: "پنل مدیریت", adminSubtitle: "آمار کلی", tabReferral: "دعوت دوستان", tabStats: "داشبورد", tabExcursions: "تورها", tabRequests: "درخواست‌ها", tabFaq: "سوالات متداول", tabCatalog: "کاتالوگ", loading: "در حال بارگذاری...", bonusBalance: "موجودی شما", invitedCount: "دوستان دعوت شده", requestsCount: "درخواست‌های ثبت شده", inviteTitle: "لینک دعوت شما", promoLabel: "کد تخفیف", copyBtn: "کپی", getQrBtn: "دریافت QR", loginTitle: "ورود", loginDesc: "آیدی تلگرام خود را وارد کنید.", loginPlaceholder: "آیدی شما", loginBtn: "ورود", roleFounder: "مالک", roleManager: "مدیر", roleUser: "مشتری", ownerBadge: "بنیان‌گذار", statsTotalUsers: "کل مشتریان", statsTotalRequests: "کل درخواست‌ها", statsRevenue: "درآمد مورد انتظار", linkCopied: "کپی شد!", withdrawBtn: "برداشت پاداش", manageManagers: "مدیریت مدیران", assignEmployee: "+ افزودن", enterTgId: "آیدی تلگرام", activeEmployees: "کارکنان فعال", managerAddError: "❌ پیدا نشد.", managerAddSuccess: "✅ آیدی {id} مدیر شد.", managerRemoveSuccess: "🗑️ حذف شد.", managerAddFail: "❌ خطا.", analyzing: "در حال تحلیل...", manageFaq: "مدیریت سوالات", deleteFaqConfirm: "حذف شود؟", addFaq: "افزودن سوال", newFaq: "سوال جدید", editFaq: "ویرایش", faqTopic: "موضوع", faqContent: "محتوا", saveBtn: "ذخیره", cancelBtn: "لغو"
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loginInputId, setLoginInputId] = useState('');
  const [lang, setLang] = useState<'ru' | 'en' | 'tr' | 'de' | 'pl' | 'ar' | 'fa'>('ru');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'referral' | 'stats' | 'excursions' | 'requests' | 'faq' | 'catalog'>('catalog');
  const [referralStats, setReferralStats] = useState({ invited: 0, requests: 0, earned: 0 });
  const [referralDetails, setReferralDetails] = useState<any[]>([]);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const tg = window.Telegram?.WebApp;

  const fetchUserData = async (tgId: number, firstName?: string, username?: string) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const { data: userData, error: fetchErr } = await supabase.from('users').select('*').eq('telegram_id', tgId).single();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        setErrorMsg(`Database Error: ${fetchErr.message}`);
      }

      let currentUser = userData;

      // САМОРЕГ: Если пользователя нет в БД — создаем его
      if (!userData && (fetchErr?.code === 'PGRST116' || !fetchErr)) {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const newUser = {
          telegram_id: tgId,
          username: username || firstName || tgUser?.first_name || `user_${tgId}`,
          balance: 0,
          role: 'user'
        };
        const { data: created, error: regError } = await supabase.from('users').insert(newUser).select().single();
        if (regError) {
          setErrorMsg(`Creation Error: ${regError.message}`);
          console.error(regError);
        }
        if (created) currentUser = created;
      }

      if (currentUser) {
        setUser(currentUser);
        const isStaff = currentUser.role === 'founder' || currentUser.role === 'manager' || currentUser.role === 'admin';
        if (isStaff) {
          setActiveTab('stats');
        }
        // Fetch invited users with their request counts
        const { data: invitedUsers } = await supabase
          .from('users')
          .select('telegram_id, username')
          .eq('referrer_id', tgId);

        if (invitedUsers && invitedUsers.length > 0) {
          const details = await Promise.all(invitedUsers.map(async (u: any) => {
            const { count: reqCount } = await supabase
              .from('requests')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', u.telegram_id)
              .neq('status', 'cancelled');
            return {
              telegram_id: u.telegram_id,
              username: u.username || `user_${u.telegram_id}`,
              requests: reqCount || 0
            };
          }));
          setReferralDetails(details);
          const totalReqs = details.reduce((sum: number, d: any) => sum + d.requests, 0);
          setReferralStats({ invited: invitedUsers.length, requests: totalReqs, earned: currentUser.balance || 0 });
        } else {
          setReferralStats({ invited: 0, requests: 0, earned: currentUser.balance || 0 });
        }
      }
    } catch (err: any) {
      setErrorMsg(`System Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }

      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');
      
      if (uid && !isNaN(parseInt(uid))) {
        await fetchUserData(parseInt(uid));
        // If we have an excursion ID, keep the catalog tab active
        return;
      }

      // 2. Try Telegram SDK Polling
      let tgUser: any = null;
      for (let i = 0; i < 5; i++) {
        tgUser = tg?.initDataUnsafe?.user;
        if (tgUser?.id) break;
        await new Promise(r => setTimeout(r, 200));
      }

      // 3. Try Raw initData Parsing
      if (!tgUser?.id && tg?.initData) {
        try {
          const paramsRaw = new URLSearchParams(tg.initData);
          const userStr = paramsRaw.get('user');
          if (userStr) tgUser = JSON.parse(decodeURIComponent(userStr));
        } catch {}
      }

      if (tgUser?.id) {
        const supported = ['ru', 'en', 'tr', 'de', 'pl', 'ar', 'fa'];
        const userLang = supported.includes(tgUser.language_code) ? tgUser.language_code : 'en';
        setLang(userLang as any);
        await fetchUserData(tgUser.id, tgUser.first_name, tgUser.username);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const t = translations[lang] || translations.en;

if (loading) return (
    <div className="min-h-screen bg-[#0f0f11] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-slate-400 font-medium animate-pulse">{t.loading}</p>
    </div>
  );

  if (!user) {
    return (
      <div className="bg-[#0f0f11] min-h-screen flex items-center justify-center p-6 text-slate-200">
        <div className="glass-card p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl border border-white/5">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold">{t.loginTitle}</h1>
            <p className="text-sm text-slate-400">{t.loginDesc}</p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-xs text-red-400 text-center animate-in fade-in zoom-in duration-300">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="number"
              value={loginInputId}
              onChange={(e) => setLoginInputId(e.target.value)}
              placeholder={t.loginPlaceholder}
              className="w-full bg-[#1a1a1d] border border-white/10 rounded-2xl p-4 text-center text-lg focus:border-primary/50 outline-none transition-all"
            />
            <button
              onClick={() => { if (loginInputId) fetchUserData(parseInt(loginInputId)); }}
              className="w-full bg-primary/20 text-primary border border-primary/30 py-4 rounded-2xl font-bold hover:bg-primary/30 transition-all active:scale-95 shadow-lg shadow-primary/5"
            >
              {t.loginBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'founder' || user.role === 'admin';
  const isManager = user.role === 'manager';
  const isStaff = isAdmin || isManager;
  const refLink = `https://t.me/Emedeotour_bot?start=${user.telegram_id}`;

  const renderContent = () => {
    switch (activeTab) {
      case 'referral':
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Balance card */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6 rounded-3xl border border-primary/20 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[60px] -z-10" />
              <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-2">{t.bonusBalance}</p>
              <h2 className="text-5xl font-black text-white mb-1">{user.balance?.toLocaleString() || '0'} <span className="text-primary">$</span></h2>
              <p className="text-[10px] text-slate-500 mb-4">1% от каждой экскурсии вашего реферала</p>
              <button
                onClick={() => setIsWithdrawOpen(true)}
                className="px-8 py-2.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all hover:bg-primary/30"
              >
                {t.withdrawBtn}
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t.invitedCount, value: referralStats.invited, icon: 'group_add', color: 'text-blue-400' },
                { label: t.requestsCount, value: referralStats.requests, icon: 'luggage', color: 'text-green-400' },
                { label: lang === 'ru' ? 'Конверсия' : lang === 'tr' ? 'Dönüşüm' : 'Conversion', value: referralStats.invited > 0 ? Math.round((referralStats.requests / referralStats.invited) * 100) + '%' : '0%', icon: 'trending_up', color: 'text-primary' },
              ].map((s) => (
                <div key={s.label} className="bg-[#1a1a1d] p-4 rounded-2xl border border-white/5 text-center">
                  <span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span>
                  <p className="text-2xl font-black text-white mt-1">{s.value}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Per-referral detail list */}
            {referralDetails.length > 0 && (
              <div className="bg-[#1a1a1d] rounded-3xl border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">group</span>
                  <h3 className="text-sm font-bold text-slate-200">
                    {lang === 'ru' ? 'Мои рефералы' : lang === 'tr' ? 'Referanslarım' : 'My Referrals'}
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {referralDetails.map((ref, idx) => {
                    const conv = ref.requests > 0 ? 100 : 0;
                    return (
                      <div key={ref.telegram_id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-black text-primary">#{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-200 truncate">@{ref.username}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{ref.telegram_id}</p>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="text-[10px] font-bold text-green-400">{ref.requests}</p>
                            <p className="text-[8px] text-slate-600 uppercase">{lang === 'ru' ? 'заявок' : lang === 'tr' ? 'sipariş' : 'orders'}</p>
                          </div>
                          <div className={`px-2 py-0.5 rounded-full text-[9px] font-black ${conv > 0 ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}`}>
                            {conv > 0 ? '✓ Купил' : 'Ожидание'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Referral link block */}
            <div className="bg-[#1a1a1d] p-5 rounded-3xl border border-primary/20 space-y-4 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-[40px] -z-10" />
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">share</span>
                {t.inviteTitle}
              </h3>
              <div className="flex gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/5">
                <input readOnly value={refLink} className="flex-1 bg-transparent px-3 text-xs font-mono text-primary outline-none min-w-0" />
                <button
                  onClick={() => { navigator.clipboard.writeText(refLink); tg?.showAlert(t.linkCopied); }}
                  className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all hover:bg-primary/30"
                >
                  {t.copyBtn}
                </button>
              </div>
              {/* Promo code */}
              <div className="flex items-center gap-2 bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.promoLabel}:</span>
                <span className="font-black text-primary font-mono flex-1">{user.telegram_id}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(String(user.telegram_id)); tg?.showAlert(t.linkCopied); }}
                  className="text-[10px] px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-bold active:scale-95 transition-all"
                >
                  {t.copyBtn}
                </button>
              </div>
              {/* QR */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="bg-white p-3 rounded-2xl w-fit shadow-xl">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(refLink)}&margin=8`} alt="QR" className="block rounded-lg" />
                </div>
                <button
                  onClick={() => {
                    // openTelegramLink triggers the bot with a start payload — most reliable method
                    const link = `https://t.me/Emedeotour_bot?start=getqr_${user.telegram_id}`;
                    try {
                      tg?.openTelegramLink(link);
                    } catch {
                      window.open(link, '_blank');
                    }
                  }}
                  className="w-full py-3 bg-primary/15 border border-primary/30 rounded-2xl text-xs font-black text-primary uppercase tracking-widest active:scale-95 transition-all hover:bg-primary/25 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                  {t.getQrBtn}
                </button>
              </div>
            </div>
          </div>
        );
      case 'stats': return <AdminStats t={t} isAdmin={isAdmin} user={user} />;
      case 'excursions': return <AdminExcursions t={t} />;
      case 'requests': return <AdminRequests t={t} />;
      case 'faq': return <AdminFaq t={t} />;
      case 'catalog': 
        const params = new URLSearchParams(window.location.search);
        const eid = params.get('eid');
        return <PublicCatalog t={t} lang={lang} initialExcursionId={eid} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-slate-100 font-sans pb-32">
      {/* Header */}
      <header className="px-6 pt-10 pb-5 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
            {activeTab === 'referral' ? (lang === 'ru' ? 'Профиль' : lang === 'tr' ? 'Profil' : 'Profile') : t.adminSubtitle}
          </p>
          <h1 className="text-2xl font-black text-white">
            {activeTab === 'referral' ? `@${user.username || 'User'}` : t.adminTitle}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${
            user.role === 'founder' ? 'bg-yellow-500/20 text-yellow-400' :
            user.role === 'admin' ? 'bg-primary/20 text-primary' :
            user.role === 'manager' ? 'bg-secondary/20 text-secondary' :
            'bg-white/5 text-slate-500'
          }`}>
            {user.role === 'founder' ? (t.ownerBadge || 'Owner') : user.role === 'admin' ? 'Admin' : user.role === 'manager' ? t.roleManager : t.roleUser}
          </span>
          <div className="relative">
            <button 
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-2 bg-[#1a1a1d] px-3 py-1.5 rounded-full border border-white/10 active:scale-95 transition-all shadow-lg"
            >
              <span className="material-symbols-outlined text-primary text-[16px]">language</span>
              <span className="text-[10px] font-black text-white uppercase tracking-wider">{lang}</span>
              <span className={`material-symbols-outlined text-[14px] text-slate-500 transition-transform ${isLangOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {isLangOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)} />
                <div className="absolute right-0 mt-2 w-28 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {(['ru', 'en', 'tr', 'de', 'pl', 'ar', 'fa'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setIsLangOpen(false); }}
                      className={`w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-between border-l-4 ${
                        lang === l ? 'bg-primary/10 text-primary border-primary' : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">
                          {l === 'ru' ? '🇷🇺' : l === 'en' ? '🇺🇸' : l === 'tr' ? '🇹🇷' : l === 'de' ? '🇩🇪' : l === 'pl' ? '🇵🇱' : l === 'ar' ? '🇦🇪' : '🇮🇷'}
                        </span>
                        <span>{l}</span>
                      </div>
                      {lang === l && <span className="material-symbols-outlined text-[14px]">check</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto">{renderContent()}</main>

      {/* Nav */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 flex justify-around items-center px-2 py-2 bg-[#1a1a1d]/90 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl">
        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
            activeTab === 'referral' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeTab === 'referral' ? "'FILL' 1" : "'FILL' 0" }}>group</span>
          <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">{lang === 'ru' ? 'Бонусы' : lang === 'tr' ? 'Bonus' : 'Bonus'}</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
            activeTab === 'catalog' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeTab === 'catalog' ? "'FILL' 1" : "'FILL' 0" }}>auto_awesome_motion</span>
          <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">{t.tabCatalog}</span>
        </button>

        {isStaff && (
          <>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
                activeTab === 'stats' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeTab === 'stats' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
              <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">{t.tabStats}</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
                activeTab === 'requests' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeTab === 'requests' ? "'FILL' 1" : "'FILL' 0" }}>list_alt</span>
              <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">{t.tabRequests}</span>
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('excursions')}
                  className={`flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
                    activeTab === 'excursions' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeTab === 'excursions' ? "'FILL' 1" : "'FILL' 0" }}>map</span>
                  <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">{t.tabExcursions}</span>
                </button>
                <button
                  onClick={() => setActiveTab('faq')}
                  className={`flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
                    activeTab === 'faq' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: activeTab === 'faq' ? "'FILL' 1" : "'FILL' 0" }}>help</span>
                  <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">{t.tabFaq}</span>
                </button>
              </>
            )}
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
