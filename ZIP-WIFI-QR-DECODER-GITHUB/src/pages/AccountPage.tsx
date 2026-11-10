import React, { useEffect, useState } from 'react';
import {
  authService,
  AuthSession,
  SyncedScanMetadataRecord,
} from '../services/authService';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface AccountPageProps {
  language?: SupportedLanguage;
  session: AuthSession | null;
  onSessionChange: (session: AuthSession | null) => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  language = 'ckb',
  session,
  onSessionChange,
  onNotify,
}) => {
  const t = TRANSLATIONS[language];
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [syncedRecords, setSyncedRecords] = useState<SyncedScanMetadataRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [syncSsidOptIn, setSyncSsidOptIn] = useState(true);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const loadAccountData = async (activeSession: AuthSession | null, pageNum = 1) => {
    if (!activeSession) {
      setSyncedRecords([]);
      setTotalRecords(0);
      return;
    }
    try {
      const settings = await authService.getUserSettings(activeSession.accessToken);
      if (settings) {
        setSyncSsidOptIn(settings.sync_ssid_opt_in);
      }
      const list = await authService.listSyncedScanHistory(
        pageNum,
        10,
        activeSession.accessToken
      );
      setSyncedRecords(list.items);
      setTotalRecords(list.totalCount);
      setPage(list.page);
      setHasMore(list.hasMore);
    } catch {
      setSyncedRecords([]);
    }
  };

  useEffect(() => {
    void loadAccountData(session, 1);
  }, [session]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
      if (authTab === 'login') {
        const nextSession = await authService.login(email, password);
        onSessionChange(nextSession);
        setPassword('');
        onNotify(t.toastSignedIn, 'success');
      } else if (authTab === 'register') {
        const nextSession = await authService.register(email, password);
        onSessionChange(nextSession);
        setPassword('');
        onNotify(t.toastRegistered, 'success');
      } else {
        await authService.requestPasswordReset(email);
        onNotify(t.toastResetSent, 'info');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await authService.logout();
    setSyncedRecords([]);
    setTotalRecords(0);
    setConfirmSignOut(false);
    onSessionChange(null);
    onNotify(t.toastSignedOut, 'info');
  };

  const handleDeleteAccount = async () => {
    if (!session) return;
    await authService.deleteOwnAccount(session.accessToken);
    setSyncedRecords([]);
    setTotalRecords(0);
    setConfirmDeleteAccount(false);
    onSessionChange(null);
    onNotify(t.toastAccountDeleted, 'info');
  };

  const handleToggleSsidOptIn = async (checked: boolean) => {
    if (!session) return;
    setSyncSsidOptIn(checked);
    await authService.upsertUserSettings({ syncSsidOptIn: checked }, session.accessToken);
  };

  const handleDeleteSyncedRecord = async (recordId: string) => {
    if (!session) return;
    await authService.deleteSyncedScanRecord(recordId, session.accessToken);
    await loadAccountData(session, page);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-[#080d1a] p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">{t.accountTitle}</h1>
          <p className="mt-1 text-xs text-slate-400">{t.accountSubtitle}</p>
        </div>
        <div className="shrink-0">
          {session ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{t.accountStatusSignedIn}:</span>
              <span dir="ltr" className="font-mono">
                {session.user.email}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-300">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span>{t.accountStatusGuest}</span>
            </span>
          )}
        </div>
      </div>

      {/* RLS & Zero-Password Privacy Architecture Notice */}
      <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-[#0c1428] to-[#080d1a] p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-300">
          {t.accountPrivacyNoticeTitle}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          {t.accountPrivacyNoticeDesc}
        </p>
      </div>

      {!session ? (
        /* Login / Register / Password Reset Form */
        <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
            {(['login', 'register', 'reset'] as const).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => {
                  setAuthTab(tabKey);
                  setErrorMsg(null);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  authTab === tabKey
                    ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                {tabKey === 'login'
                  ? t.accountLoginTab
                  : tabKey === 'register'
                  ? t.accountRegisterTab
                  : t.accountResetTab}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold text-slate-300">
                {t.accountEmailLabel}
              </label>
              <input
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.accountEmailPlaceholder}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#050811] px-4 py-3 text-left font-mono text-xs text-white focus:border-sky-400 focus:outline-none"
              />
            </div>

            {authTab !== 'reset' && (
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  {t.accountPasswordLabel}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.accountPasswordPlaceholder}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#050811] px-4 py-3 text-left font-mono text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className=" rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-sky-500/20 hover:brightness-110"
            >
              {authTab === 'login'
                ? t.btnSignIn
                : authTab === 'register'
                ? t.btnCreateAccount
                : t.btnSendResetLink}
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated User Dashboard & RLS-Isolated Synced History */
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
              <div>
                <div className="text-sm font-bold text-white">{t.accountSyncSsidLabel}</div>
                <div className="text-xs text-slate-400" dir="ltr">
                  UID: {session.user.id}
                </div>
              </div>
              <input
                type="checkbox"
                checked={syncSsidOptIn}
                onChange={(e) => void handleToggleSsidOptIn(e.target.checked)}
                className="h-5 w-5 accent-sky-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!confirmSignOut ? (
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(true)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold uppercase text-slate-200 hover:bg-slate-700"
                >
                  {t.btnSignOut}
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2">
                  <span className="text-xs text-amber-200">{t.btnConfirmSignOut}</span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black"
                  >
                    {t.btnSignOut}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300"
                  >
                    {t.btnCancel}
                  </button>
                </div>
              )}

              {!confirmDeleteAccount ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(true)}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-bold uppercase text-rose-300 hover:bg-rose-500/25"
                >
                  {t.btnDeleteAccount}
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 p-2">
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount()}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    {t.btnConfirmDeleteAccount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300"
                  >
                    {t.btnCancel}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Paginated RLS-Isolated Metadata Records */}
          <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400">
                {t.accountSyncedHistoryHeading} ({totalRecords})
              </h2>
            </div>

            {syncedRecords.length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">{t.accountSyncedHistoryEmpty}</p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {syncedRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0b1222] p-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          dir="ltr"
                          className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300"
                        >
                          {rec.security_type}
                        </span>
                        <span dir="ltr" className="text-xs font-bold text-white font-mono">
                          {rec.ssid || '(SSID Redacted)'}
                        </span>
                      </div>
                      <p dir="ltr" className="mt-1 text-[11px] text-slate-400">
                        {new Date(rec.scanned_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSyncedRecord(rec.id)}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                    >
                      {t.btnDeleteEntry}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(page > 1 || hasMore) && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => void loadAccountData(session, page - 1)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs text-slate-400" dir="ltr">
                  Page {page}
                </span>
                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={() => void loadAccountData(session, page + 1)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
