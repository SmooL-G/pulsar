import { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, ListChecks, Lock } from 'lucide-react';
import { useI18n } from '../../i18n';

interface ChecklistComposerProps {
  onClose: () => void;
  onSend: (data: { title?: string; items: { id: string; text: string }[] }) => void;
}

function uid() {
  // Short non-crypto id is fine — scope is one message's metadata.
  return Math.random().toString(36).slice(2, 10);
}

export function ChecklistComposer({ onClose, onSend }: ChecklistComposerProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<{ id: string; text: string }[]>([
    { id: uid(), text: '' },
    { id: uid(), text: '' },
  ]);
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus title on mount.
    firstRef.current?.focus();
  }, []);

  const addItem = (after?: number) => {
    const id = uid();
    setItems((prev) => {
      const next = [...prev];
      const idx = after !== undefined ? after + 1 : next.length;
      next.splice(idx, 0, { id, text: '' });
      return next;
    });
    // Focus the newly added input on the next tick.
    setTimeout(() => itemRefs.current[id]?.focus(), 0);
  };

  const updateItem = (id: string, text: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const handleSubmit = () => {
    const cleanItems = items
      .map((it) => ({ id: it.id, text: it.text.trim() }))
      .filter((it) => it.text.length > 0);
    if (cleanItems.length === 0) return;
    onSend({
      title: title.trim() || undefined,
      items: cleanItems,
    });
    onClose();
  };

  const canSubmit = items.some((it) => it.text.trim().length > 0);

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
            <ListChecks size={18} className="text-primary-400" />
            <h3 className="text-white font-semibold">{t('checklist.composerTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Title input */}
          <input
            ref={firstRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('checklist.titlePlaceholder')}
            maxLength={120}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-primary-500 transition-colors"
          />

          {/* Items */}
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-2 group">
                <div className="w-5 h-5 rounded border border-gray-500 shrink-0" />
                <input
                  ref={(el) => { itemRefs.current[it.id] = el; }}
                  type="text"
                  value={it.text}
                  onChange={(e) => updateItem(it.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem(idx);
                    }
                    if (e.key === 'Backspace' && !it.text && items.length > 1) {
                      e.preventDefault();
                      removeItem(it.id);
                      const prev = items[idx - 1];
                      if (prev) setTimeout(() => itemRefs.current[prev.id]?.focus(), 0);
                    }
                  }}
                  placeholder={t('checklist.itemPlaceholder')}
                  maxLength={200}
                  className="flex-1 bg-transparent border-b border-dark-500 focus:border-primary-500 px-1 py-1.5 text-white placeholder-gray-500 text-sm outline-none transition-colors"
                />
                <button
                  onClick={() => removeItem(it.id)}
                  disabled={items.length === 1}
                  className="p-1 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add row */}
          <button
            onClick={() => addItem()}
            className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors mt-2"
          >
            <Plus size={16} />
            {t('checklist.addItem')}
          </button>

          {/* E2E notice */}
          <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Lock size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              {t('checklist.notEncrypted')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-dark-500 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-dark-600 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('checklist.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
