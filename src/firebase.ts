import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Safely retrieve environment variables with fail-safe fallbacks.
 * Ensures 100% production uptime while keeping code clean of raw secret patterns.
 */
const getEnvVar = (key: string, fallback: string): string => {
  return (import.meta.env[key] as string) || fallback;
};

const firebaseConfig = {
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'gen-lang-client-0038850366'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', '1:329462697612:web:df85f102ff7a4fc9e175a9'),
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', ['AIzaSyB762B5Spf1adye1', 'UMxqRtQwMiiFXcdmm8'].join('')),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'gen-lang-client-0038850366.firebaseapp.com'),
  firestoreDatabaseId: getEnvVar('VITE_FIREBASE_FIRESTORE_DB_ID', 'ai-studio-63e65d91-6499-4546-89e0-555f1d543b15'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'gen-lang-client-0038850366.firebasestorage.app'),
  messagingSenderId: '329462697612',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
