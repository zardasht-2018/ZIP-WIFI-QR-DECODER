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
import { DEFAULT_LANGUAGE, SupportedLanguage, TRANSLATIONS } from './i18n/translations';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => storageService.getHistory());
  const [currentResult, setCurrentResult] = useState<ParsedQRResult | null>(null);
  const [currentSourceLabel, setCurrentSourceLabel] = useState<string>('');
  const [multiQrCandidates, setMultiQrCandidates] = useState<{
    results: ParsedQRResult[];
    sourceLabel: string;
  } | null>(null);
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

  useEffect(() => {
    // Hydrate from persistent IndexedDB on mount and subscribe to updates
    void storageService.initHistoryDatabase().then((entries) => {
      setHistory(entries);
    });
    const unsubscribe = storageService.subscribe((entries) => {
      setHistory(entries);
    });
    return unsubscribe;
  }, []);

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
    setMultiQrCandidates(null);

    if (settings.historyEnabled) {
      const updated = storageService.addHistoryEntry(parsed);
      setHistory(updated);
    }

    setActivePage('results');
    if (parsed.hasPasswordField && parsed.password !== null) {
      showNotification(`${t.toastPasswordExtracted} "${parsed.ssid}"!`, 'success');
    } else {
      showNotification(`${t.toastDecodedPayload} (${parsed.formatLabel})`, 'info');
    }
  };

  const handleMultipleDecodedPayloads = (payloads: string[], sourceLabel = 'Uploaded Image') => {
    if (payloads.length === 1) {
      handleDecodedPayload(payloads[0], sourceLabel);
      return;
    }
    const parsedList = payloads.map((p) => parseQRPayload(p));
    setMultiQrCandidates({ results: parsedList, sourceLabel });
    showNotification(t.toastMultipleQrFound, 'info');
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

      {/* Multi-QR Selection Banner when an uploaded image contains 2+ QR codes */}
      {multiQrCandidates && (
        <div className="mx-auto mt-6 w-full max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-sky-500/50 bg-[#0c1428] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">{t.multiQrTitle}</h2>
                <p className="text-xs text-slate-300">{t.multiQrSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setMultiQrCandidates(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300"
              >
                {t.btnCancel}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {multiQrCandidates.results.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-[#070b16] p-4"
                >
                  <div className="min-w-0">
                    <span
                      dir="ltr"
                      className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300"
                    >
                      {item.category === 'WIFI' ? item.securityType : item.category}
                    </span>
                    <p dir="ltr" className="mt-1.5 truncate font-mono text-sm font-bold text-white">
                      {item.ssid}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleDecodedPayload(item.rawPayload, multiQrCandidates.sourceLabel)
                    }
                    className="rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shrink-0"
                  >
                    {t.btnSelectThisQr}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {activePage === 'home' && (
          <Home
            language={language}
            onNavigate={setActivePage}
            onDecodedPayload={handleDecodedPayload}
            onMultipleDecodedPayloads={handleMultipleDecodedPayloads}
            onSelectHistoryResult={(res) => {
              setCurrentResult(res);
              setCurrentSourceLabel('Scan History');
              setActivePage('results');
            }}
            onNotify={showNotification}
            recentHistory={history}
            onError={(msg) => showNotification(msg, 'error')}
          />
        )}

        {activePage === 'scanner' && (
          <ScannerPage
            preferredCameraId={settings.preferredCameraId}
            language={language}
            onDetected={handleDecodedPayload}
            onMultipleDetected={handleMultipleDecodedPayloads}
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
