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

/** What Firestore's own saved state says, read straight from IndexedDB: who holds the lease, which clients are
 *  registered, and how many write batches are queued. Logged once when a write gets stuck. */
export const fsDiagnostics = (): Promise<string> => new Promise((resolve) => {
  const done = (s: string) => resolve(s.slice(0, 160));
  try {
    const req = indexedDB.open('firestore/[DEFAULT]/bebe-tracker-1cf656/main');
    req.onerror = () => done('diag: could not open cache');
    req.onsuccess = () => {
      const db = req.result;
      try {
        const names = ['owner', 'clientMetadata', 'mutations'].filter((n) => db.objectStoreNames.contains(n));
        const tx = db.transaction(names, 'readonly');
        const out: Record<string, unknown> = {};
        for (const n of names) { const r = tx.objectStore(n).getAll(); r.onsuccess = () => { out[n] = r.result; }; }
        tx.oncomplete = () => {
          db.close();
          const now = Date.now();
          const owner = (out.owner as { ownerId: string; leaseTimestampMs: number }[] | undefined)?.[0];
          const clients = (out.clientMetadata as { clientId: string; updateTimeMs: number; inForeground: boolean; networkEnabled: boolean }[] | undefined) ?? [];
          const muts = (out.mutations as unknown[] | undefined)?.length ?? 0;
          const c = clients.map((x) => `${x.clientId.slice(0, 4)}${x.clientId === owner?.ownerId ? '*' : ''} ${x.inForeground ? 'fg' : 'bg'}${x.networkEnabled ? '' : ' net-off'} ${Math.round((now - x.updateTimeMs) / 1000)}s`).join(', ');
          done(`diag: queued ${muts}; lease ${owner ? `${owner.ownerId.slice(0, 4)} ${Math.round((now - owner.leaseTimestampMs) / 1000)}s` : 'none'}; clients ${clients.length}: ${c}`);
        };
        tx.onerror = () => { db.close(); done('diag: read failed'); };
      } catch (e) { db.close(); done(`diag: ${String(e)}`); }
    };
  } catch (e) { done(`diag: ${String(e)}`); }
});
