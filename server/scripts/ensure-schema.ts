/**
 * Creează tabele/coloane lipsă (support chat, payout, jobs) fără migrate deploy.
 * Rulează: npm run db:ensure   (din folderul server)
 */
import { initDatabase } from "../src/db";

initDatabase()
  .then(() => {
    console.log("[db:ensure] Schema actualizată.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("[db:ensure] Eșuat:", e);
    process.exit(1);
  });
