import React from 'react';
import type { Message } from '@pulsar/shared';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-600 text-gray-400 italic text-sm">
          Message deleted
        </div>
      </div>
    );
  }

  if (message.type === 'SYSTEM') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-dark-600 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const time = format(new Date(message.createdAt), 'HH:mm');

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-2' : 'mt-0.5'}`}>
      {/* Avatar for other users */}
      {!isOwn && showAvatar && (
        <div className="w-8 h-8 rounded-full bg-primary-400 flex items-center justify-center text-white text-xs font-medium mr-2 mt-auto shrink-0">
          {message.sender?.username?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      {!isOwn && !showAvatar && <div className="w-8 mr-2 shrink-0" />}

      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name */}
        {!isOwn && showAvatar && (
          <p className="text-xs font-medium text-primary-500 mb-0.5 ml-1">
            {message.sender?.displayName || message.sender?.username}
          </p>
        )}

        {/* Bubble */}
        <div
          className={`
            px-3 py-2 rounded-2xl text-sm leading-relaxed inline-block
            ${isOwn
              ? 'bg-primary-500 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-dark-600 text-gray-900 dark:text-gray-100 rounded-bl-md'}
          `}
        >
          {/* File attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-1">
              {message.attachments.map((file) => (
                <div
                  key={file.id}
                  className={`text-xs ${isOwn ? 'text-blue-100' : 'text-blue-500'} underline cursor-pointer`}
                >
                  📎 {file.fileName}
                </div>
              ))}
            </div>
          )}

          {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

          {/* Time & edited indicator */}
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {message.isEdited && (
              <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                edited
              </span>
            )}
            <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
              {time}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
