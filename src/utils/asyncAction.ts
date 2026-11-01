/** Event-only actions report failures through StorageProvider; forms await and handle rejection themselves. */
export function runUiAction(action: () => void | Promise<unknown>): void {
  try { void Promise.resolve(action()).catch(() => { /* StorageProvider exposes the error banner. */ }); }
  catch (error) { console.error(error); }
}
