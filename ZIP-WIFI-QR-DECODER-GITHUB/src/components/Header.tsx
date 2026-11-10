import React from 'react';
import { ActivePage } from '../types';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  historyCount: number;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  onNavigate,
  historyCount,
  language,
  onLanguageChange,
}) => {
  const t = TRANSLATIONS[language];

  const navItems: Array<{ id: ActivePage; label: string; count?: number }> = [
    { id: 'home', label: t.navHome },
    { id: 'scanner', label: t.navScanner },
    { id: 'results', label: t.navResults },
    { id: 'history', label: t.navHistory, count: historyCount },
    { id: 'settings', label: t.navSettings },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#050811]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 text-start focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 shadow-lg shadow-sky-500/20">
            <span className="font-mono text-sm font-black tracking-tighter text-white">ZIP</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white sm:text-lg" dir="ltr">
                {t.brandPrimary}
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300" dir="ltr">
                {t.brandSecondary}
              </span>
            </div>
            <p className="font-mono text-[10px] font-bold tracking-[0.22em] text-slate-400" dir="ltr">
              {t.tagline}
            </p>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-3.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.count === 'number' && (
                    <span className="ms-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300" dir="ltr">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Language Switcher: کوردی | English */}
          <div
            className="inline-flex items-center rounded-xl border border-slate-700/90 bg-[#0a1020] p-0.5"
            role="group"
            aria-label="Language Selector"
          >
            <button
              type="button"
              onClick={() => onLanguageChange('ckb')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                language === 'ckb'
                  ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              کوردی
            </button>
            <span className="px-0.5 text-xs text-slate-600" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              dir="ltr"
            >
              English
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
