import { useState } from 'react';
import { X, Search, Users, MessageCircle, Check, Megaphone } from 'lucide-react';
import { api } from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useI18n } from '../../i18n';
import { PulsarBadge } from '../ui/PulsarBadge';

interface NewChatModalProps {
  onClose: () => void;
}

export function NewChatModal({ onClose }: NewChatModalProps) {
  const { t } = useI18n();
  const { setActiveChat, addChat } = useChatStore();
  const [mode, setMode] = useState<'dm' | 'group' | 'channel'>('dm');
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [channelPublic, setChannelPublic] = useState(false);
  const [channelComments, setChannelComments] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (query: string) => {
    setSearch(query);
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    try {
      const { data } = await api.get(`/users?search=${encodeURIComponent(query)}`);
      setUsers(data.users || data || []);
    } catch {
      setUsers([]);
    }
  };

  const createDM = async (userId: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/chats/direct', { targetUserId: userId });
      const chat = data.chat || data;
      addChat(chat);
      setActiveChat(chat);
      onClose();
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (user: any) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) return prev.filter((u) => u.id !== user.id);
      return [...prev, user];
    });
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/groups', { name: groupName });
      const chat = data.group || data;

      // Add selected members
      if (selectedUsers.length > 0) {
        await api.post(`/groups/${chat.id}/members`, {
          userIds: selectedUsers.map((u) => u.id),
        });
      }

      addChat(chat);
      setActiveChat(chat);
      onClose();
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const createChannel = async () => {
    if (!channelName.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/channels', {
        name: channelName,
        description: channelDesc || undefined,
        isPublic: channelPublic,
        allowComments: channelComments,
      });
      const chat = data.channel || data;
      addChat(chat);
      setActiveChat(chat);
      onClose();
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold">{mode === 'dm' ? t('chat.newChat') : mode === 'group' ? t('chat.newGroup') : 'New Channel'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 mx-2 mt-2 bg-gray-100 dark:bg-dark-600 rounded-lg">
          <button
            onClick={() => { setMode('dm'); setSelectedUsers([]); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors
              ${mode === 'dm' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <MessageCircle size={16} />
            {t('chat.newChat')}
          </button>
          <button
            onClick={() => setMode('group')}
            className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors
              ${mode === 'group' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Users size={16} />
            {t('chat.newGroup')}
          </button>
          <button
            onClick={() => setMode('channel')}
            className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors
              ${mode === 'channel' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Megaphone size={16} />
            Channel
          </button>
        </div>

        <div className="p-4">
          {mode === 'channel' ? (
            <>
              <input
                type="text"
                placeholder="Channel name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 mb-3"
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 mb-3 resize-none"
              />

              <div className="space-y-2 mb-4">
                <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-600 cursor-pointer">
                  <span className="text-sm text-gray-300">Public channel</span>
                  <input
                    type="checkbox"
                    checked={channelPublic}
                    onChange={(e) => setChannelPublic(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-500"
                  />
                </label>
                <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-600 cursor-pointer">
                  <span className="text-sm text-gray-300">Allow comments</span>
                  <input
                    type="checkbox"
                    checked={channelComments}
                    onChange={(e) => setChannelComments(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-500"
                  />
                </label>
              </div>

              <button
                onClick={createChannel}
                disabled={loading || !channelName.trim()}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Channel'}
              </button>
            </>
          ) : mode === 'dm' ? (
            <>
              {/* Search users */}
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('chat.findUser')}
                  value={search}
                  onChange={(e) => searchUsers(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>

              {/* User list */}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => createDM(user.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                      {(user.displayName || user.username)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1">{user.displayName || user.username}<PulsarBadge level={(user as any).verificationLevel || 0} size={12} /></p>
                      <p className="text-xs text-gray-400 font-mono">
                        {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                      </p>
                    </div>
                  </button>
                ))}
                {search.length >= 2 && users.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">{t('common.unknown')}</p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Group name */}
              <input
                type="text"
                placeholder={t('chat.groupName')}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 mb-3"
                autoFocus
              />

              {/* Selected members */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      onClick={() => toggleUser(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium cursor-pointer hover:bg-primary-500/30 transition-colors"
                    >
                      {u.displayName || u.username}
                      <PulsarBadge level={(u as any).verificationLevel || 0} size={10} />
                      <X size={12} />
                    </span>
                  ))}
                </div>
              )}

              {/* Search to add members */}
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('chat.addMembers')}
                  value={search}
                  onChange={(e) => searchUsers(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* User list for group */}
              <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
                {users.map((user) => {
                  const isSelected = selectedUsers.some((u) => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        isSelected ? 'bg-primary-500/10' : 'hover:bg-gray-100 dark:hover:bg-dark-600'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                        {(user.displayName || user.username)?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1">{user.displayName || user.username}<PulsarBadge level={(user as any).verificationLevel || 0} size={12} /></p>
                        <p className="text-xs text-gray-400 font-mono">
                          {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={createGroup}
                disabled={loading || !groupName.trim()}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('chat.create')}{selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
