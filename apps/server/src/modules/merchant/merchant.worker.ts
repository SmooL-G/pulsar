import { sweepTrustedTiers, downgradeExpiredOfficial } from './merchant.service.js';

const TRUSTED_TICK_MS = 60 * 60 * 1000;       // 1 hour
const EXPIRY_TICK_MS = 24 * 60 * 60 * 1000;   // 24 hours

/** Periodic recomputation of TRUSTED tier + expiry-based OFFICIAL downgrade. */
export function startMerchantWorker() {
  const trustedTick = async () => {
    try {
      const { promoted, demoted } = await sweepTrustedTiers();
      if (promoted + demoted > 0) {
        console.log(`[merchant] trusted sweep: +${promoted} promoted, -${demoted} demoted`);
      }
    } catch (err) {
      console.error('[merchant] trusted sweep failed:', err);
    }
  };

  const expiryTick = async () => {
    try {
      const downgraded = await downgradeExpiredOfficial();
      if (downgraded > 0) {
        console.log(`[merchant] downgraded ${downgraded} expired OFFICIAL subscription(s)`);
      }
    } catch (err) {
      console.error('[merchant] expiry sweep failed:', err);
    }
  };

  setTimeout(trustedTick, 30_000);  // first run shortly after boot
  setInterval(trustedTick, TRUSTED_TICK_MS);

  setTimeout(expiryTick, 60_000);
  setInterval(expiryTick, EXPIRY_TICK_MS);
}
