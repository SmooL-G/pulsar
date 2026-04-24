import { useState } from 'react';
import { X, Clock, Calendar } from 'lucide-react';
import { useI18n } from '../../i18n';

interface ScheduleModalProps {
  onClose: () => void;
  onSchedule: (sendAt: Date) => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function isoLocal(d: Date): string {
  // Format for <input type="datetime-local">: YYYY-MM-DDTHH:MM (no timezone).
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleModal({ onClose, onSchedule }: ScheduleModalProps) {
  const { t } = useI18n();
  // Default: an hour from now (rounded to next minute).
  const initial = new Date(Date.now() + 60 * 60 * 1000);
  initial.setSeconds(0, 0);
  const [value, setValue] = useState<string>(isoLocal(initial));

  const handleConfirm = () => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return;
    if (d.getTime() < Date.now() + 30 * 1000) return; // Server enforces this too.
    onSchedule(d);
    onClose();
  };

  // Quick presets (relative to now).
  const presets: { label: string; minutes: number }[] = [
    { label: t('schedule.in1h'), minutes: 60 },
    { label: t('schedule.in3h'), minutes: 180 },
    { label: t('schedule.tomorrow9'), minutes: 0 /* special-cased */ },
    { label: t('schedule.nextWeek'), minutes: 7 * 24 * 60 },
  ];

  const applyPreset = (p: { label: string; minutes: number }) => {
    let d: Date;
    if (p.label === t('schedule.tomorrow9')) {
      d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else {
      d = new Date(Date.now() + p.minutes * 60 * 1000);
      d.setSeconds(0, 0);
    }
    setValue(isoLocal(d));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-700 border border-dark-500 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary-400" />
            <h3 className="text-white font-semibold">{t('schedule.title')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="px-3 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual picker */}
          <div>
            <label className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={12} />
              {t('schedule.exact')}
            </label>
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min={isoLocal(new Date(Date.now() + 60 * 1000))}
              className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              {t('schedule.timezoneNotice')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-dark-500">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('schedule.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
