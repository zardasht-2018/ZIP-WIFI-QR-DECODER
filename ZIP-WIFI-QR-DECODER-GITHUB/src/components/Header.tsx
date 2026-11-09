import React from 'react';
import { ActivePage } from '../types';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activePage, onNavigate, historyCount }) => {
  const navItems: Array<{ id: ActivePage; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'scanner', label: 'Scanner' },
    { id: 'results', label: 'Results' },
    { id: 'history', label: `History (${historyCount})` },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#050811]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 shadow-lg shadow-sky-500/20">
            <span className="font-mono text-sm font-black tracking-tighter text-white">ZIP</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">
                ZIP WiFi QR Decoder
              </span>
              <span className="hidden rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400 sm:inline-block">
                Local PWA
              </span>
            </div>
            <p className="text-[11px] font-semibold tracking-widest text-slate-400">
              SCAN. REVEAL. CONNECT.
            </p>
          </div>
        </button>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
