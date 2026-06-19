import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { InfoPanel } from './InfoPanel';
import { BottomNav, type Tab } from './BottomNav';
import { NewsFeed } from './NewsFeed';
import { FriendsPanel } from '../friends/FriendsPanel';
import { WalletPanel } from '../wallet/WalletPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { useChatStore } from '../../store/chatStore';
import { useShortcut } from '../../hooks/useKeyboardShortcuts';

/**
 * Authenticated app shell. Five-tab BottomNav drives the main view:
 *   Home / Chat / Contacts / Wallet / Settings
 *
 * Default tab on first mount is "home" (dashboard) so the user lands
 * on a curated info view rather than a chat list. Selecting "chat"
 * reveals the classic sidebar + active-chat + InfoPanel layout. The
 * other three tabs (contacts/wallet/settings) reuse the existing
 * panel components as full-screen overlays for now — they were already
 * built as modals and the user can iterate UX from here.
 */
export function AppLayout() {
  const activeChat = useChatStore((s) => s.activeChat);
  const [tab, setTab] = useState<Tab>('home');
  const [showInfo, setShowInfo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // When activeChat is cleared, snap back to the chat-list sidebar.
  useEffect(() => {
    if (!activeChat) {
      setShowSidebar(true);
      setShowInfo(false);
    }
  }, [activeChat]);

  // Global shortcuts:
  //   Ctrl+K → jump to Chat tab + focus the chat-search input
  //   Escape → if any modal-tab is active, return to Home
  useShortcut('ctrl+k', () => {
    setTab('chat');
    setShowSidebar(true);
    // Defer so the Sidebar mounts first, then we grab its search field.
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder*="оиск"], input[placeholder*="earch"]',
      );
      input?.focus();
    }, 30);
  });
  useShortcut('escape', () => {
    if (tab === 'contacts' || tab === 'wallet' || tab === 'settings') setTab('home');
  }, { enabled: tab !== 'home' && tab !== 'chat' });

  // Switching to "chat" tab while no chat selected → show list.
  // Switching to any other tab while a chat is active is fine — we
  // keep it loaded in the background.
  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (next === 'chat') setShowSidebar(true);
  };

  const closeAndReturnHome = () => setTab('home');

  // BottomNav reserves ~72px (icons + label + safe-area). Bottom padding
  // here keeps active content above it without each panel needing its
  // own offset.
  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-800 overflow-hidden pb-[72px]">
      {/* Main content area — fills everything above the BottomNav */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {tab === 'home' && <NewsFeed />}

        {tab === 'chat' && (
          <>
            {/* Left Sidebar — Chat List */}
            <div
              className={`
                ${showSidebar ? 'flex' : 'hidden'}
                ${activeChat ? 'hidden md:flex' : 'flex'}
                flex-col w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-dark-500
                shrink-0
              `}
            >
              <Sidebar onChatSelect={() => setShowSidebar(false)} />
            </div>

            {/* Center — Chat Area (centered max-w container on desktop) */}
            <div
              className={`
                ${!activeChat ? 'hidden md:flex' : 'flex'}
                flex-col flex-1 min-w-0
              `}
            >
              <ChatArea
                onBack={() => {
                  setShowSidebar(true);
                  useChatStore.getState().setActiveChat(null);
                }}
                onToggleInfo={() => setShowInfo(!showInfo)}
              />
            </div>

            {/* Right Panel — Info */}
            {showInfo && activeChat && (
              <>
                <div className="hidden lg:flex flex-col w-80 border-l border-gray-200 dark:border-dark-500 shrink-0">
                  <InfoPanel onClose={() => setShowInfo(false)} />
                </div>
                <div
                  className="lg:hidden fixed inset-0 bg-black/50 z-50 flex justify-end"
                  onClick={(e) => { if (e.target === e.currentTarget) setShowInfo(false); }}
                >
                  <div className="w-full max-w-sm bg-white dark:bg-dark-700 h-full animate-slide-in-right">
                    <InfoPanel onClose={() => setShowInfo(false)} />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Tabs that reuse existing panels (rendered inline within shell,
            not as modals — their built-in `fixed inset-0` is still in
            effect, which makes them overlay the empty content area; the
            BottomNav stays visible above them via z-index ordering). */}
        {tab === 'contacts' && <FriendsPanel onClose={closeAndReturnHome} />}
        {tab === 'wallet' && <WalletPanel onClose={closeAndReturnHome} />}
        {tab === 'settings' && <SettingsPanel onClose={closeAndReturnHome} />}
      </div>

      {/* Bottom navigation — pinned, always visible */}
      <BottomNav active={tab} onChange={handleTabChange} />
    </div>
  );
}
