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

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => storageService.getHistory());
  const [currentResult, setCurrentResult] = useState<ParsedQRResult | null>(null);
  const [currentSourceLabel, setCurrentSourceLabel] = useState<string>('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showNotification = (
    message: string,
    type: 'success' | 'info' | 'error' = 'info'
  ) => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleDecodedPayload = (rawPayload: string, sourceLabel = 'QR Scan') => {
    const parsed = parseQRPayload(rawPayload);
    setCurrentResult(parsed);
    setCurrentSourceLabel(sourceLabel);

    if (settings.historyEnabled) {
      const updated = storageService.addHistoryEntry(parsed);
      setHistory(updated);
    }

    setActivePage('results');
    if (parsed.hasPasswordField && parsed.password !== null) {
      showNotification(`Decoded Wi-Fi network "${parsed.ssid}" and extracted password!`, 'success');
    } else {
      showNotification(`Decoded QR payload (${parsed.formatLabel})`, 'info');
    }
  };

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    const updated = storageService.saveSettings(partial);
    setSettings(updated);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    const updated = storageService.deleteHistoryEntry(id);
    setHistory(updated);
    showNotification('Removed scan entry from local history.', 'info');
  };

  const handleClearAllHistory = () => {
    storageService.clearHistory();
    setHistory([]);
    showNotification('Cleared all local scan history.', 'info');
  };

  const handleClearAllStoredData = () => {
    const reset = storageService.clearAllStoredData();
    setSettings(reset);
    setHistory([]);
    setCurrentResult(null);
    showNotification('All stored history and settings have been wiped from local storage.', 'info');
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <Header
        activePage={activePage}
        onNavigate={setActivePage}
        historyCount={history.length}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-sky-500/40 bg-[#0c1428]/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md">
          {toast.message}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {activePage === 'home' && (
          <Home
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
            onScanAnother={() => setActivePage('scanner')}
            onDecodedPayload={handleDecodedPayload}
            onNotify={showNotification}
          />
        )}

        {activePage === 'history' && (
          <HistoryPage
            history={history}
            historyEnabled={settings.historyEnabled}
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

        {activePage === 'settings' && (
          <SettingsPage
            settings={settings}
            historyCount={history.length}
            onUpdateSettings={handleUpdateSettings}
            onClearAllStoredData={handleClearAllStoredData}
            onNotify={showNotification}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#04060d] py-5 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <span className="font-semibold text-slate-300">
            ZIP WiFi QR Decoder — SCAN. REVEAL. CONNECT.
          </span>
          <span>100% Client-Side Processing • Offline-Ready PWA • Zero Telemetry</span>
        </div>
      </footer>
    </div>
  );
}
