import React, { useEffect, useState } from 'react';
import { ActivePage, AppSettings, ParsedQRResult, ScanHistoryEntry } from './types';
import { parseQRPayload } from './services/wifiParser';
import { storageService } from './services/storageService';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { ScannerPage } from './pages/ScannerPage';
import { ResultsPage } from './pages/ResultsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountPage } from './pages/AccountPage';
import { authService, AuthSession } from './services/authService';
import { DEFAULT_LANGUAGE, SupportedLanguage, TRANSLATIONS } from './i18n/translations';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => storageService.getHistory());
  const [currentResult, setCurrentResult] = useState<ParsedQRResult | null>(null);
  const [currentSourceLabel, setCurrentSourceLabel] = useState<string>('');
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => authService.getCurrentSession());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const language: SupportedLanguage = settings.language || DEFAULT_LANGUAGE;
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const isRtl = language === 'ckb';
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    document.title = 'ZIP QR — Wi-Fi QR Decoder';
  }, [language]);

  const showNotification = (
    message: string,
    type: 'success' | 'info' | 'error' = 'info'
  ) => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleDecodedPayload = (rawPayload: string, sourceLabel = 'QR Scan') => {
    const parsed = parseQRPayload(rawPayload);
    setCurrentResult(parsed);
    setCurrentSourceLabel(sourceLabel);

    if (settings.historyEnabled) {
      const updated = storageService.addHistoryEntry(parsed);
      setHistory(updated);
      if (authSession) {
        void authService.insertSyncedScanRecord(parsed, undefined, authSession.accessToken).catch(() => {});
      }
    }

    setActivePage('results');
    if (parsed.hasPasswordField && parsed.password !== null) {
      showNotification(`${t.toastPasswordExtracted} "${parsed.ssid}"!`, 'success');
    } else {
      showNotification(`${t.toastDecodedPayload} (${parsed.formatLabel})`, 'info');
    }
  };

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    const updated = storageService.saveSettings(partial);
    setSettings(updated);
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    handleUpdateSettings({ language: newLang });
    showNotification(TRANSLATIONS[newLang].toastLanguageChanged, 'info');
  };

  const handleDeleteHistoryEntry = (id: string) => {
    const updated = storageService.deleteHistoryEntry(id);
    setHistory(updated);
    showNotification(t.toastEntryDeleted, 'info');
  };

  const handleClearAllHistory = () => {
    storageService.clearHistory();
    setHistory([]);
    showNotification(t.toastHistoryCleared, 'info');
  };

  const handleClearAllStoredData = () => {
    const reset = storageService.clearAllStoredData();
    setSettings(reset);
    setHistory([]);
    setCurrentResult(null);
    showNotification(t.toastDataWiped, 'info');
  };

  return (
    <div
      dir={language === 'ckb' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white"
    >
      <Header
        activePage={activePage}
        onNavigate={setActivePage}
        historyCount={history.length}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      {toast && (
        <div className="fixed bottom-5 end-5 z-50 max-w-sm rounded-2xl border border-sky-500/40 bg-[#0c1428]/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md">
          {toast.message}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {activePage === 'home' && (
          <Home
            language={language}
            onNavigate={setActivePage}
            onDecodedPayload={handleDecodedPayload}
            onSelectHistoryResult={(res) => {
              setCurrentResult(res);
              setCurrentSourceLabel('Scan History');
              setActivePage('results');
            }}
            recentHistory={history}
            onError={(msg) => showNotification(msg, 'error')}
          />
        )}

        {activePage === 'scanner' && (
          <ScannerPage
            preferredCameraId={settings.preferredCameraId}
            language={language}
            onDetected={handleDecodedPayload}
            onCancel={() => setActivePage('home')}
            onCameraChange={(deviceId) => handleUpdateSettings({ preferredCameraId: deviceId })}
          />
        )}

        {activePage === 'results' && (
          <ResultsPage
            result={currentResult}
            sourceLabel={currentSourceLabel}
            autoMaskPassword={settings.autoMaskPassword}
            language={language}
            onScanAnother={() => setActivePage('scanner')}
            onDecodedPayload={handleDecodedPayload}
            onNotify={showNotification}
          />
        )}

        {activePage === 'history' && (
          <HistoryPage
            history={history}
            historyEnabled={settings.historyEnabled}
            language={language}
            onToggleHistoryEnabled={(enabled) => handleUpdateSettings({ historyEnabled: enabled })}
            onSelectResult={(res) => {
              setCurrentResult(res);
              setCurrentSourceLabel('Scan History');
              setActivePage('results');
            }}
            onDeleteEntry={handleDeleteHistoryEntry}
            onClearAll={handleClearAllHistory}
            onScanNow={() => setActivePage('scanner')}
          />
        )}

        {activePage === 'account' && (
          <AccountPage
            language={language}
            session={authSession}
            onSessionChange={(next) => {
              setAuthSession(next);
              if (!next) {
                setCurrentResult(null);
              }
            }}
            onNotify={showNotification}
          />
        )}

        {activePage === 'settings' && (
          <SettingsPage
            settings={settings}
            historyCount={history.length}
            language={language}
            onUpdateSettings={handleUpdateSettings}
            onClearAllStoredData={handleClearAllStoredData}
            onNotify={showNotification}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#04060d] py-5 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <span className="font-semibold text-slate-300" dir="ltr">
            {t.footerLeft}
          </span>
          <span>{t.footerRight}</span>
        </div>
      </footer>
    </div>
  );
}
