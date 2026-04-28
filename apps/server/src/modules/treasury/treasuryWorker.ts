import { findExpiredProposalIds, finalizeProposal, isTreasuryEnabled } from './treasury.service.js';
import { sendPushToUser } from '../push/push.service.js';

const TICK_MS = 60 * 60 * 1000; // hourly

/**
 * Closes proposals whose endsAt has passed. Tick is hourly — tight enough
 * that authors learn the result within an hour, cheap enough to never matter.
 */
export function startTreasuryWorker() {
  console.log('[TreasuryWorker] Started');

  const tick = async () => {
    try {
      if (!(await isTreasuryEnabled())) return;
      const ids = await findExpiredProposalIds();
      if (ids.length === 0) return;

      console.log(`[TreasuryWorker] Closing ${ids.length} expired proposal(s)`);
      for (const id of ids) {
        try {
          const r = await finalizeProposal(id);
          if (!r) continue;
          const titleSnippet = r.title.length > 60 ? r.title.slice(0, 60) + '...' : r.title;
          const body =
            r.outcome === 'PASSED'
              ? `Принято: ${titleSnippet}. Залог возвращён.`
              : r.outcome === 'FAILED'
                ? `Отклонено: ${titleSnippet}. Залог возвращён.`
                : `Без кворума: ${titleSnippet}. Залог сожжён.`;
          sendPushToUser(r.authorId, {
            title: '🗳️ Голосование завершено',
            body,
            url: '/?settings=treasury',
            tag: `treasury:${id}`,
          }).catch(() => {});
        } catch (err) {
          console.error(`[TreasuryWorker] finalize ${id} failed:`, err);
        }
      }
    } catch (err) {
      console.error('[TreasuryWorker] tick error:', err);
    }
  };

  setTimeout(tick, 60_000); // first run a minute after boot
  setInterval(tick, TICK_MS);
}
