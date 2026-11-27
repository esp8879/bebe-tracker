/** Last few sync events and Firestore warnings, shown under Settings' sync line for diagnosis. */
export const logSync = (msg: string) => {
  try {
    const log = JSON.parse(localStorage.getItem('bebe.syncLog') || '[]') as [number, string][];
    log.unshift([Date.now(), msg.slice(0, 160)]);
    localStorage.setItem('bebe.syncLog', JSON.stringify(log.slice(0, 8)));
  } catch { /* ignore */ }
};

export const readSyncLog = (): [number, string][] => {
  try { return JSON.parse(localStorage.getItem('bebe.syncLog') || '[]'); } catch { return []; }
};

/** Keep Firestore's own warnings (write-stream errors and the like) where Settings can show them. */
export const captureFirestoreWarnings = () => {
  for (const level of ['warn', 'error'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      orig(...args);
      const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).join(' ');
      if (text.includes('@firebase/firestore')) logSync(text.replace(/^.*?@firebase\/firestore:\s*/, ''));
    };
  }
};
