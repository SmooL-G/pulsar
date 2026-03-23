import React from 'react';
import { X, Users, Bell, Shield, Link as LinkIcon } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface InfoPanelProps {
  onClose: () => void;
}

export function InfoPanel({ onClose }: InfoPanelProps) {
  const activeChat = useChatStore((s) => s.activeChat);

  if (!activeChat) return null;

  const isGroup = activeChat.type === 'GROUP';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
        <h3 className="font-semibold">
          {isGroup ? 'Group Info' : 'Contact Info'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
            {(activeChat.name || '?')[0]?.toUpperCase()}
          </div>
          <h4 className="font-semibold text-lg">{activeChat.name || 'Direct Message'}</h4>
          {activeChat.description && (
            <p className="text-sm text-gray-400 mt-1">{activeChat.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-1">
          {isGroup && (
            <InfoAction icon={<Users size={18} />} label="Members" value={`${(activeChat as any).memberCount || 0}`} />
          )}
          <InfoAction icon={<Bell size={18} />} label="Notifications" value="On" />
          {isGroup && activeChat.inviteCode && (
            <InfoAction icon={<LinkIcon size={18} />} label="Invite Link" value="Copy" />
          )}
          <InfoAction icon={<Shield size={18} />} label="Encryption" value="Planned" />
        </div>

        {/* Shared Media placeholder */}
        <div>
          <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Shared Media
          </h5>
          <div className="grid grid-cols-3 gap-1">
            <div className="aspect-square bg-gray-100 dark:bg-dark-600 rounded" />
            <div className="aspect-square bg-gray-100 dark:bg-dark-600 rounded" />
            <div className="aspect-square bg-gray-100 dark:bg-dark-600 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoAction({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600 cursor-pointer">
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm text-gray-400">{value}</span>
    </div>
  );
}
