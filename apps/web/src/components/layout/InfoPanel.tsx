import React, { useEffect, useState } from 'react';
import { X, Users, Bell, Shield, Link as LinkIcon, Copy, Check, Trash2 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';

interface InfoPanelProps {
  onClose: () => void;
}

export function InfoPanel({ onClose }: InfoPanelProps) {
  const { t } = useI18n();
  const { activeChat, setActiveChat, fetchChats } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isGroup = activeChat?.type === 'GROUP';

  useEffect(() => {
    if (!isGroup || !activeChat?.id) return;
    api.get(`/groups/${activeChat.id}/members`).then(({ data }) => {
      setMembers(data.members || []);
    }).catch(() => {});
  }, [isGroup, activeChat?.id]);

  if (!activeChat) return null;

  const copyInviteLink = async () => {
    if (!activeChat.inviteCode) return;
    const link = `${window.location.origin}/invite/${activeChat.inviteCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = isGroup && activeChat.ownerId === user?.id;

  const handleDeleteGroup = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await api.delete(`/groups/${activeChat.id}`);
      setActiveChat(null);
      fetchChats();
      onClose();
    } catch {
      // Error
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
        <h3 className="font-semibold">
          {isGroup ? t('info.groupInfo') : t('info.contactInfo')}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
            {(activeChat.name || '?')[0]?.toUpperCase()}
          </div>
          <h4 className="font-semibold text-lg">{activeChat.name || t('chat.directMessage')}</h4>
          {activeChat.description && (
            <p className="text-sm text-gray-400 mt-1">{activeChat.description}</p>
          )}
        </div>

        {/* Invite link */}
        {isGroup && activeChat.inviteCode && (
          <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-2">{t('info.inviteLink')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-primary-400 bg-dark-700/50 rounded-lg px-3 py-2 truncate">
                {window.location.origin}/invite/{activeChat.inviteCode}
              </code>
              <button
                onClick={copyInviteLink}
                className="p-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors shrink-0"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {isGroup && (
            <InfoAction icon={<Users size={18} />} label={t('info.members')} value={`${members.length}`} />
          )}
          <InfoAction icon={<Bell size={18} />} label={t('info.notifications')} value={t('info.on')} />
          <InfoAction icon={<Shield size={18} />} label={t('info.encryption')} value={t('info.planned')} />
        </div>

        {/* Members list */}
        {isGroup && members.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('info.members')} ({members.length})
            </h5>
            <div className="space-y-1">
              {members.map((m: any) => (
                <div key={m.user.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                      {(m.user.displayName || m.user.username)?.[0]?.toUpperCase() || '?'}
                    </div>
                    {m.user.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-dark-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user.displayName || m.user.username}</p>
                    {m.role !== 'MEMBER' && (
                      <p className="text-xs text-primary-400">{m.role.toLowerCase()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete group */}
        {isOwner && (
          <button
            onClick={handleDeleteGroup}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              confirmDelete
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
            }`}
          >
            <Trash2 size={16} />
            {confirmDelete ? t('chat.confirmDelete') : t('chat.deleteGroup')}
          </button>
        )}

        <div>
          <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('info.sharedMedia')}
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

function InfoAction({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600 cursor-pointer">
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm text-gray-400">{value}</span>
    </div>
  );
}
