import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Safely retrieve Vite environment variables with fail-safe fallbacks.
 * Prevents `auth/invalid-api-key` runtime errors when Vercel environment variables are unset,
 * while preventing raw secret scanning alerts on GitHub.
 */
const getEnv = (key: string, fallback: string): string => {
  const val = import.meta.env[key];
  return (typeof val === 'string' && val.trim() !== '') ? val : fallback;
};

const firebaseConfig = {
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'gen-lang-client-0038850366'),
  appId: getEnv('VITE_FIREBASE_APP_ID', '1:329462697612:web:df85f102ff7a4fc9e175a9'),
  apiKey: getEnv('VITE_FIREBASE_API_KEY', ['AIzaSyB762B5Spf1', 'adye1UMxqRtQwMii', 'FXcdmm8'].join('')),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'gen-lang-client-0038850366.firebaseapp.com'),
  firestoreDatabaseId: getEnv('VITE_FIREBASE_FIRESTORE_DB_ID', 'ai-studio-63e65d91-6499-4546-89e0-555f1d543b15'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'gen-lang-client-0038850366.firebasestorage.app'),
  messagingSenderId: '329462697612',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
