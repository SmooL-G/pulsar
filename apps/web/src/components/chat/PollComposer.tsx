import { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, BarChart3, Lock, Check } from 'lucide-react';
import { useI18n } from '../../i18n';

interface PollComposerProps {
  onClose: () => void;
  onSend: (data: {
    question: string;
    options: { id: string; text: string }[];
    allowMultiple: boolean;
  }) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function PollComposer({ onClose, onSend }: PollComposerProps) {
  const { t } = useI18n();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: uid(), text: '' },
    { id: uid(), text: '' },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const optRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const questionRef = useRef<HTMLInputElement>(null);

  useEffect(() => { questionRef.current?.focus(); }, []);

  const addOption = (after?: number) => {
    if (options.length >= 10) return;
    const id = uid();
    setOptions((prev) => {
      const next = [...prev];
      const idx = after !== undefined ? after + 1 : next.length;
      next.splice(idx, 0, { id, text: '' });
      return next;
    });
    setTimeout(() => optRefs.current[id]?.focus(), 0);
  };

  const updateOption = (id: string, text: string) => {
    setOptions((prev) => prev.map((op) => (op.id === id ? { ...op, text } : op)));
  };

  const removeOption = (id: string) => {
    setOptions((prev) => (prev.length > 2 ? prev.filter((op) => op.id !== id) : prev));
  };

  const handleSubmit = () => {
    const q = question.trim();
    const clean = options.map((op) => ({ id: op.id, text: op.text.trim() })).filter((op) => op.text);
    if (!q || clean.length < 2) return;
    onSend({ question: q, options: clean, allowMultiple });
    onClose();
  };

  const canSubmit = question.trim().length > 0 &&
    options.filter((o) => o.text.trim().length > 0).length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-700 border border-dark-500 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-primary-400" />
            <h3 className="text-white font-semibold">{t('poll.composerTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Question */}
          <input
            ref={questionRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('poll.questionPlaceholder')}
            maxLength={200}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-primary-500 transition-colors"
          />

          {/* Options */}
          <div className="space-y-2 pt-2">
            <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider">
              {t('poll.options')}
            </p>
            {options.map((op, idx) => (
              <div key={op.id} className="flex items-center gap-2 group">
                <span className="w-5 h-5 rounded-full border border-gray-500 shrink-0" />
                <input
                  ref={(el) => { optRefs.current[op.id] = el; }}
                  type="text"
                  value={op.text}
                  onChange={(e) => updateOption(op.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOption(idx);
                    }
                    if (e.key === 'Backspace' && !op.text && options.length > 2) {
                      e.preventDefault();
                      removeOption(op.id);
                      const prev = options[idx - 1];
                      if (prev) setTimeout(() => optRefs.current[prev.id]?.focus(), 0);
                    }
                  }}
                  placeholder={t('poll.optionPlaceholder')}
                  maxLength={120}
                  className="flex-1 bg-transparent border-b border-dark-500 focus:border-primary-500 px-1 py-1.5 text-white placeholder-gray-500 text-sm outline-none transition-colors"
                />
                <button
                  onClick={() => removeOption(op.id)}
                  disabled={options.length === 2}
                  className="p-1 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add option */}
          {options.length < 10 && (
            <button
              onClick={() => addOption()}
              className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors mt-1"
            >
              <Plus size={16} />
              {t('poll.addOption')}
            </button>
          )}

          {/* Allow multiple toggle */}
          <label className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-dark-800/50 border border-dark-500 cursor-pointer">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                allowMultiple ? 'bg-primary-500 border-primary-500' : 'border-gray-500'
              }`}
            >
              {allowMultiple && <Check size={14} className="text-white" />}
            </div>
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="sr-only"
            />
            <span className="text-sm text-gray-200">{t('poll.allowMultiple')}</span>
          </label>

          {/* Notice */}
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Lock size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200/90 leading-relaxed">{t('poll.notEncrypted')}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-dark-500 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-dark-600 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('poll.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
