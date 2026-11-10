import React, { useState } from 'react';
import { AppSettings } from '../types';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface SettingsPageProps {
  settings: AppSettings;
  historyCount: number;
  language?: SupportedLanguage;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onClearAllStoredData: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  language = 'ckb',
  onUpdateSettings,
  onClearAllStoredData,
  onNotify,
}) => {
  const t = TRANSLATIONS[language];
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
        <h1 className="text-2xl font-black text-white">{t.settingsTitle}</h1>
        <p className="mt-1 text-xs text-slate-400">{t.settingsSubtitle}</p>
      </div>

      {/* Language Settings */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          {t.settingsLanguageHeading}
        </h2>
        <p className="text-xs text-slate-400">{t.settingsLanguageDesc}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ language: 'ckb' });
              onNotify(TRANSLATIONS.ckb.toastLanguageChanged, 'info');
            }}
            className={`rounded-2xl border p-4 text-start transition ${
              language === 'ckb'
                ? 'border-sky-400 bg-sky-500/15 text-white'
                : 'border-slate-800 bg-[#0b1222] text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="text-base font-bold">کوردی (کوردیی سۆرانی)</div>
            <div className="mt-1 text-xs text-slate-400">Kurdish Sorani • RTL</div>
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ language: 'en' });
              onNotify(TRANSLATIONS.en.toastLanguageChanged, 'info');
            }}
            className={`rounded-2xl border p-4 text-start transition ${
              language === 'en'
                ? 'border-sky-400 bg-sky-500/15 text-white'
                : 'border-slate-800 bg-[#0b1222] text-slate-300 hover:border-slate-700'
            }`}
            dir="ltr"
          >
            <div className="text-base font-bold">English</div>
            <div className="mt-1 text-xs text-slate-400">English Interface • LTR</div>
          </button>
        </div>
      </section>

      {/* Theme Settings */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          {t.settingsThemeHeading}
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              {
                id: 'electric-blue',
                title: t.theme1Title,
                desc: t.theme1Desc,
              },
              {
                id: 'cyber-purple',
                title: t.theme2Title,
                desc: t.theme2Desc,
              },
              {
                id: 'emerald-shield',
                title: t.theme3Title,
                desc: t.theme3Desc,
              },
            ] as const
          ).map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => {
                onUpdateSettings({ accentTheme: theme.id });
                onNotify(t.toastThemeUpdated, 'info');
              }}
              className={`rounded-2xl border p-4 text-start transition ${
                settings.accentTheme === theme.id
                  ? 'border-sky-400 bg-sky-500/15 text-white'
                  : 'border-slate-800 bg-[#0b1222] text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="text-sm font-bold">{theme.title}</div>
              <div className="mt-1 text-xs text-slate-400">{theme.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
          <div>
            <div className="text-sm font-bold text-white">{t.maskPasswordTitle}</div>
            <div className="text-xs text-slate-400">{t.maskPasswordDesc}</div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoMaskPassword}
            onChange={(e) => onUpdateSettings({ autoMaskPassword: e.target.checked })}
            className="h-5 w-5 shrink-0 accent-sky-500"
          />
        </div>
      </section>

      {/* History Preferences */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          {t.historyPrefsHeading}
        </h2>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
          <div>
            <div className="text-sm font-bold text-white">{t.enableHistoryTitle}</div>
            <div className="text-xs text-slate-400">{t.enableHistoryDesc}</div>
          </div>
          <input
            type="checkbox"
            checked={settings.historyEnabled}
            onChange={(e) => onUpdateSettings({ historyEnabled: e.target.checked })}
            className="h-5 w-5 shrink-0 accent-sky-500"
          />
        </div>
      </section>

      {/* Privacy & Security Architecture */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          {t.privacyHeading}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
            <div className="font-bold text-white">{t.privacyCard1Title}</div>
            <p className="mt-1 text-slate-400">{t.privacyCard1Desc}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
            <div className="font-bold text-white">{t.privacyCard2Title}</div>
            <p className="mt-1 text-slate-400">{t.privacyCard2Desc}</p>
          </div>
        </div>

        <div className="pt-2">
          {!confirmWipe ? (
            <button
              type="button"
              onClick={() => setConfirmWipe(true)}
              className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-5 py-3 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/25"
            >
              {t.btnClearAllStoredData}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4">
              <span className="text-xs font-semibold text-rose-200">{t.confirmWipePrompt}</span>
              <button
                type="button"
                onClick={() => {
                  onClearAllStoredData();
                  setConfirmWipe(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase text-white"
              >
                {t.btnConfirmWipe}
              </button>
              <button
                type="button"
                onClick={() => setConfirmWipe(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                {t.btnCancel}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* About ZIP QR & Developer Creator Card */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
            {t.aboutHeading}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{t.aboutDescription}</p>
        </div>

        {/* Creator / Developer Identity Card */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-[#0c1428] via-[#090d1a] to-[#140c29] p-5 shadow-xl sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <span className="inline-block rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                {t.creatorSectionBadge}
              </span>
              <h3 className="text-xl font-black text-white">{t.creatorNameValue}</h3>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
                {t.creatorTitleValue}
              </p>
              <p className="text-sm font-medium text-slate-200">{t.creatorCreditLine}</p>
            </div>

            <div className="flex flex-col items-start gap-2.5 sm:items-end">
              <a
                href="mailto:zardashtmuhammad12@gmail.com"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110"
              >
                <span>{t.creatorContactBtn}</span>
              </a>
              <a
                href="mailto:zardashtmuhammad12@gmail.com"
                dir="ltr"
                className="font-mono text-xs text-sky-300 hover:underline"
              >
                zardashtmuhammad12@gmail.com
              </a>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-800/90 pt-4 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-[#050811]/80 p-3">
              <span className="text-[11px] text-slate-400">{t.creatorNameLabel}</span>
              <p className="mt-0.5 font-bold text-white">{t.creatorNameValue}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#050811]/80 p-3">
              <span className="text-[11px] text-slate-400">{t.creatorTitleLabel}</span>
              <p className="mt-0.5 font-bold text-white">{t.creatorTitleValue}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#050811]/80 p-3">
              <span className="text-[11px] text-slate-400">{t.creatorProjectLabel}</span>
              <p className="mt-0.5 font-bold text-sky-300" dir="ltr">
                {t.creatorProjectValue}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
