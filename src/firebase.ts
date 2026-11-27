import { initializeApp } from 'firebase/app';
import { captureFirestoreWarnings } from './lib/syncLog';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

export const PROJECT_ID = 'bebe-tracker-1cf656';
const app = initializeApp({
  projectId: PROJECT_ID,
  appId: '1:110836298989:web:5da96a7491c1af688208e4',
  apiKey: 'AIzaSyAsYNFh2O5bxiC0K7FocUDmF6lJWF3bb58',
  authDomain: 'bebe-tracker-1cf656.firebaseapp.com',
  storageBucket: 'bebe-tracker-1cf656.firebasestorage.app',
  messagingSenderId: '110836298989',
});

captureFirestoreWarnings();

/** Set by the watchdog's self-repair: delete this device's Firestore cache before Firestore opens it. Requests on
 *  the same IndexedDB database run in order, so the delete finishes before the SDK's open below. */
export const RESET_CACHE_KEY = 'bebe.resetCache';
try {
  if (localStorage.getItem(RESET_CACHE_KEY)) {
    localStorage.removeItem(RESET_CACHE_KEY);
    indexedDB.deleteDatabase(`firestore/[DEFAULT]/${'bebe-tracker-1cf656'}/main`);
  }
} catch { /* ignore */ }

/** Persistent IndexedDB cache: offline reads and queued writes survive reloads. */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
