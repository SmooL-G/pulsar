/**
 * Sticky-style date label rendered between messages of different days.
 * Centred, low-contrast pill — same look as the major messengers.
 */
export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3" aria-hidden="false">
      <span className="px-3 py-1 rounded-full text-xs text-gray-300 bg-dark-700/70 backdrop-blur">
        {label}
      </span>
    </div>
  );
}
