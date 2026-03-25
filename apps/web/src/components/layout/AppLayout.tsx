import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { InfoPanel } from './InfoPanel';
import { useChatStore } from '../../store/chatStore';

export function AppLayout() {
  const activeChat = useChatStore((s) => s.activeChat);
  const [showInfo, setShowInfo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // When activeChat is cleared (e.g. group deleted), show sidebar and hide info
  useEffect(() => {
    if (!activeChat) {
      setShowSidebar(true);
      setShowInfo(false);
    }
  }, [activeChat]);

  return (
    <div className="flex h-full bg-white dark:bg-dark-800 overflow-hidden">
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

      {/* Center — Chat Area */}
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

      {/* Right Panel — Info (desktop: sidebar, mobile: modal overlay) */}
      {showInfo && activeChat && (
        <>
          {/* Desktop sidebar */}
          <div className="hidden lg:flex flex-col w-80 border-l border-gray-200 dark:border-dark-500 shrink-0">
            <InfoPanel onClose={() => setShowInfo(false)} />
          </div>
          {/* Mobile/tablet modal */}
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
    </div>
  );
}
