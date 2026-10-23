import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const app = initializeApp({
  projectId: 'bebe-tracker-1cf656',
  appId: '1:110836298989:web:5da96a7491c1af688208e4',
  apiKey: 'AIzaSyAsYNFh2O5bxiC0K7FocUDmF6lJWF3bb58',
  authDomain: 'bebe-tracker-1cf656.firebaseapp.com',
  storageBucket: 'bebe-tracker-1cf656.firebasestorage.app',
  messagingSenderId: '110836298989',
});

/** Persistent IndexedDB cache: offline reads and queued writes survive reloads. */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
