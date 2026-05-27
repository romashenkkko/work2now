/** Temporary diagnostics for publish-and-reserve (set PUBLISH_RESERVE_DEBUG=false to silence). */
export function debugPublishReserve(message: string, meta?: Record<string, unknown>): void {
  if (process.env.PUBLISH_RESERVE_DEBUG === "false") return;
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[PublishReserve DEBUG] ${message}`, meta);
  } else {
    console.log(`[PublishReserve DEBUG] ${message}`);
  }
}
