import { useState } from 'react';
import { api } from '../../services/api';

interface Button {
  text: string;
  callbackData: string;
}

interface InlineBotButtonsProps {
  buttons: Button[][];  // rows of buttons
  messageId: string;
}

export function InlineBotButtons({ buttons, messageId }: InlineBotButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = async (callbackData: string) => {
    if (loading) return;
    setLoading(callbackData);
    try {
      await api.post(`/messages/${messageId}/callback`, { callbackData });
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {buttons.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((btn, bi) => (
            <button
              key={bi}
              onClick={() => handleClick(btn.callbackData)}
              disabled={loading === btn.callbackData}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 hover:bg-primary-500/30 text-primary-400 border border-primary-500/20 hover:border-primary-500/40 transition-all disabled:opacity-50"
            >
              {btn.text}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
